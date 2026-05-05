// WildFire AI Detection System - JavaScript
// Final Year Project - UPDATED WITH MULTI-NODE SUPPORT

// ============================================
// GLOBAL VARIABLES AND CONFIGURATION
// ============================================

const API_CONFIG = {
    BACKEND_URL: 'http://agni-guard-alb-1595568876.ap-south-1.elb.amazonaws.com',
    WS_URL: 'ws://agni-guard-alb-1595568876.ap-south-1.elb.amazonaws.com:8080',
    FETCH_INTERVAL: 5000,
    ENABLE_LIVE_DATA: true
};

const CONFIG = {
    SENSOR_UPDATE_INTERVAL: 3000,
    DASHBOARD_UPDATE_INTERVAL: 1000,
    NODE_COUNT: 6,
    
    THRESHOLDS: {
        temperature: { warning: 35, critical: 40, max: 50 },
        humidity: { warning: 35, critical: 25, max: 100 },
        pm25: { warning: 200, critical: 300, max: 500 },
        pm10: { warning: 300, critical: 500, max: 800 },
        gas: { warning: 10, critical: 20, max: 50 },
        
        // Fire stage thresholds
        fireStageThresholds: {
            normal: { min: 0, max: 24 },
            alert: { min: 25, max: 49 },
            elevated: { min: 50, max: 74 },
            critical: { min: 75, max: 100 }
        },
        
        // Rate thresholds
        priorityScore: { critical: 0.70, elevated: 0.55, alert: 0.45 },
        tempRate: { critical: 3.0, elevated: 2.0, alert: 1.0 },
        humidityRate: { critical: -5.0, elevated: -4.0, alert: -2.0 },
        gasRate: { critical: -5000, elevated: -3000, alert: -1000 },
        windSpeed: { critical: 8.0, elevated: 6.0, alert: 4.0 }
    }
};

// Current node data structure
let nodesData = {};
let aggregateData = {};
let currentActiveNode = 1;
let dashboardInterval;
let lastUpdateTime = new Date();

// Initialize nodes data structure
function initializeNodesData() {
    for (let i = 1; i <= CONFIG.NODE_COUNT; i++) {
        nodesData[i] = {
            nodeId: i,
            timestamp: new Date(),
            online: false,
            tempFused: 0,
            humidityFused: 0,
            pressureFused: 0,
            gasRatio: 0,
            riskScore: 0,
            fireStage: 0,
            stageName: 'NORMAL',
            tempRate: 0,
            humidityRate: 0,
            gasRate: 0,
            soc: 0,
            rssi: 0
        };
    }
}

initializeNodesData();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get fire stage classification
 */
function getFireStageClass(riskScore) {
    if (riskScore >= CONFIG.THRESHOLDS.fireStageThresholds.critical.min) {
        return { stage: 3, name: 'CRITICAL', class: 'critical' };
    } else if (riskScore >= CONFIG.THRESHOLDS.fireStageThresholds.elevated.min) {
        return { stage: 2, name: 'ELEVATED', class: 'elevated' };
    } else if (riskScore >= CONFIG.THRESHOLDS.fireStageThresholds.alert.min) {
        return { stage: 1, name: 'ALERT', class: 'alert' };
    } else {
        return { stage: 0, name: 'NORMAL', class: 'normal' };
    }
}

/**
 * Get status based on rate parameters
 */
function getRateStatus(type, value) {
    const thresholds = CONFIG.THRESHOLDS;
    
    switch(type) {
        case 'tempRate':
            if (value >= thresholds.tempRate.critical) return { class: 'critical', text: 'CRITICAL' };
            if (value >= thresholds.tempRate.elevated) return { class: 'elevated', text: 'ELEVATED' };
            if (value >= thresholds.tempRate.alert) return { class: 'alert', text: 'ALERT' };
            return { class: 'normal', text: 'NORMAL' };
            
        case 'humidityRate':
            if (value <= thresholds.humidityRate.critical) return { class: 'critical', text: 'CRITICAL' };
            if (value <= thresholds.humidityRate.elevated) return { class: 'elevated', text: 'ELEVATED' };
            if (value <= thresholds.humidityRate.alert) return { class: 'alert', text: 'ALERT' };
            return { class: 'normal', text: 'NORMAL' };
            
        case 'gasRate':
            if (value <= thresholds.gasRate.critical) return { class: 'critical', text: 'CRITICAL' };
            if (value <= thresholds.gasRate.elevated) return { class: 'elevated', text: 'ELEVATED' };
            if (value <= thresholds.gasRate.alert) return { class: 'alert', text: 'ALERT' };
            return { class: 'normal', text: 'NORMAL' };
            
        case 'windSpeed':
            if (value >= thresholds.windSpeed.critical) return { class: 'critical', text: 'CRITICAL' };
            if (value >= thresholds.windSpeed.elevated) return { class: 'elevated', text: 'ELEVATED' };
            if (value >= thresholds.windSpeed.alert) return { class: 'alert', text: 'ALERT' };
            return { class: 'normal', text: 'NORMAL' };
            
        default:
            return { class: 'normal', text: 'NORMAL' };
    }
}

/**
 * Format timestamp
 */
function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

/**
 * Format date and time
 */
function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch dashboard data from Google Sheets API
 */
async function fetchDashboardDataFromAPI() {
    try {
        const [nodesRes, aggregateRes, alertsRes] = await Promise.all([
            fetch(`${API_CONFIG.BACKEND_URL}/api/sensor-data`),
            fetch(`${API_CONFIG.BACKEND_URL}/api/aggregate`),
            fetch(`${API_CONFIG.BACKEND_URL}/api/alerts`)
        ]);

        if (!nodesRes.ok || !aggregateRes.ok) {
            throw new Error('Backend API error');
        }

        const nodes = await nodesRes.json();
        const aggregate = await aggregateRes.json();
        const alerts = await alertsRes.json();

        return {
            status: 'ok',
            nodes: nodes,
            aggregate: aggregate,
            alerts: alerts
        };

    } catch (error) {
        console.error('❌ Error fetching from backend:', error);
        return null;
    }
}

/**
 * Update all dashboard data from API
 */
async function updateDashboardDataFromAPI() {
    const apiData = await fetchDashboardDataFromAPI();
    
    if (!apiData) {
        console.warn('⚠️ No data from API, using simulation');
        return false;
    }
    
    // Update aggregate data
    if (apiData.aggregate) {
        aggregateData = apiData.aggregate;
    }
    
    // Update node data
    if (apiData.nodes && Array.isArray(apiData.nodes)) {
        apiData.nodes.forEach(node => {
            if (node.nodeId && nodesData[node.nodeId]) {
                nodesData[node.nodeId] = {
                    nodeId: node.nodeId,
                    timestamp: new Date(node.timestamp),
                    online: node.online,
                    tempFused: parseFloat(node.tempFused) || 0,
                    humidityFused: parseFloat(node.humidityFused) || 0,
                    pressureFused: parseFloat(node.pressureFused) || 0,
                    gasRatio: parseFloat(node.gasRatio) || 0,
                    riskScore: parseFloat(node.riskScore) || 0,
                    fireStage: parseInt(node.fireStage) || 0,
                    stageName: node.stageName || 'NORMAL',
                    tempRate: parseFloat(node.tempRate) || 0,
                    humidityRate: parseFloat(node.humidityRate) || 0,
                    gasRate: parseFloat(node.gasRate) || 0,
                    soc: parseInt(node.soc) || 0,
                    rssi: parseInt(node.rssi) || 0
                };
            }
        });
    }
    
    lastUpdateTime = new Date();
    return true;
}

/**
 * Generate simulated sensor data
 */
function generateSimulatedNodeData(nodeId) {
    const node = nodesData[nodeId];
    
    // Simulate realistic changes
    node.tempFused = node.tempFused + (Math.random() - 0.5) * 2;
    node.tempFused = Math.max(15, Math.min(45, node.tempFused));
    
    node.humidityFused = node.humidityFused + (Math.random() - 0.5) * 3;
    node.humidityFused = Math.max(20, Math.min(95, node.humidityFused));
    
    node.pressureFused = node.pressureFused + (Math.random() - 0.5) * 2;
    node.pressureFused = Math.max(1000, Math.min(1030, node.pressureFused));
    
    node.gasRatio = node.gasRatio + (Math.random() - 0.5) * 0.1;
    node.gasRatio = Math.max(0.3, Math.min(0.8, node.gasRatio));
    
    // Calculate risk score based on parameters
    let riskScore = 0;
    if (node.tempFused > 35) riskScore += (node.tempFused - 35) * 2;
    if (node.humidityFused < 35) riskScore += (35 - node.humidityFused) * 1.5;
    if (node.gasRatio > 0.6) riskScore += (node.gasRatio - 0.6) * 20;
    
    node.riskScore = Math.max(0, Math.min(100, riskScore));
    
    const fireStage = getFireStageClass(node.riskScore);
    node.fireStage = fireStage.stage;
    node.stageName = fireStage.name;
    
    // Simulate rates
    node.tempRate = (Math.random() - 0.5) * 2;
    node.humidityRate = (Math.random() - 0.5) * 4;
    node.gasRate = (Math.random() - 0.5) * 2000;
    
    node.soc = Math.max(10, node.soc - (Math.random() * 0.5));
    node.online = Math.random() > 0.05; // 95% online
    node.rssi = Math.floor(-100 + Math.random() * 40);
    node.timestamp = new Date();
}

// ============================================
// DASHBOARD UI FUNCTIONS
// ============================================

/**
 * Initialize node tabs
 */
function initializeNodeTabs() {
    const tabsContainer = document.getElementById('nodeTabs');
    if (!tabsContainer) return;
    
    let tabsHTML = '';
    for (let i = 1; i <= CONFIG.NODE_COUNT; i++) {
        tabsHTML += `
            <button class="node-tab ${i === 1 ? 'active' : ''}" 
                    data-node="${i}" 
                    onclick="switchNode(${i})">
                <span class="node-label">Node ${i}</span>
                <span class="node-status" id="nodeStatus${i}">●</span>
            </button>
        `;
    }
    tabsContainer.innerHTML = tabsHTML;
}

/**
 * Switch active node
 */
function switchNode(nodeId) {
    currentActiveNode = nodeId;
    
    // Update tab buttons
    document.querySelectorAll('.node-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-node="${nodeId}"]`).classList.add('active');
    
    // Update node dashboard
    updateNodeDashboard(nodeId);
    
    console.log(`✓ Switched to Node ${nodeId}`);
}

/**
 * Update node dashboard display
 */
function updateNodeDashboard(nodeId) {
    const node = nodesData[nodeId];
    
    // Update node info section
    const nodeInfo = document.getElementById('currentNodeInfo');
    if (nodeInfo) {
        const onlineStatus = node.online ? 'ONLINE' : 'OFFLINE';
        const onlineClass = node.online ? 'online' : 'offline';
        
        nodeInfo.innerHTML = `
            <div class="node-info-header">
                <h3>Node ${nodeId} Details</h3>
                <div class="node-info-status">
                    <span class="status-badge ${onlineClass}">${onlineStatus}</span>
                    <span class="timestamp">${formatDateTime(node.timestamp)}</span>
                </div>
            </div>
        `;
    }
    
    // Update node sensors
    updateNodeSensors(node);
    
    // Update node level indicator
    updateNodeLevel(node);
}

/**
 * Update node sensor cards
 */
function updateNodeSensors(node) {
    const sensorsContainer = document.getElementById('nodeSensorsContainer');
    if (!sensorsContainer) return;
    
    const fireStage = getFireStageClass(node.riskScore);
    
    sensorsContainer.innerHTML = `
        <div class="node-sensors-grid">
            <!-- Temperature -->
            <div class="node-sensor-card">
                <div class="sensor-title">
                    <i class="fas fa-thermometer-half"></i>
                    <span>Temperature</span>
                </div>
                <div class="sensor-value">${node.tempFused.toFixed(1)}°C</div>
                <div class="sensor-detail">Rate: ${node.tempRate.toFixed(2)}°C/min</div>
                <div class="sensor-status ${getRateStatus('tempRate', node.tempRate).class}">
                    ${getRateStatus('tempRate', node.tempRate).text}
                </div>
            </div>
            
            <!-- Humidity -->
            <div class="node-sensor-card">
                <div class="sensor-title">
                    <i class="fas fa-tint"></i>
                    <span>Humidity</span>
                </div>
                <div class="sensor-value">${node.humidityFused.toFixed(1)}%</div>
                <div class="sensor-detail">Rate: ${node.humidityRate.toFixed(2)}%/min</div>
                <div class="sensor-status ${getRateStatus('humidityRate', node.humidityRate).class}">
                    ${getRateStatus('humidityRate', node.humidityRate).text}
                </div>
            </div>
            
            <!-- Pressure -->
            <div class="node-sensor-card">
                <div class="sensor-title">
                    <i class="fas fa-gauge"></i>
                    <span>Pressure</span>
                </div>
                <div class="sensor-value">${node.pressureFused.toFixed(2)} hPa</div>
                <div class="sensor-detail">Gas Ratio: ${node.gasRatio.toFixed(2)}</div>
                <div class="sensor-status normal">NORMAL</div>
            </div>
            
            <!-- Gas Resistance -->
            <div class="node-sensor-card">
                <div class="sensor-title">
                    <i class="fas fa-wind"></i>
                    <span>Gas Resistance</span>
                </div>
                <div class="sensor-value">${node.gasRatio.toFixed(3)}</div>
                <div class="sensor-detail">Rate: ${node.gasRate.toFixed(0)}Ω/min</div>
                <div class="sensor-status ${getRateStatus('gasRate', node.gasRate).class}">
                    ${getRateStatus('gasRate', node.gasRate).text}
                </div>
            </div>
            
            <!-- Risk Score -->
            <div class="node-sensor-card">
                <div class="sensor-title">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Risk Score</span>
                </div>
                <div class="sensor-value">${node.riskScore.toFixed(1)}</div>
                <div class="sensor-detail">Stage: ${node.stageName}</div>
                <div class="sensor-status ${fireStage.class}">${fireStage.name}</div>
            </div>
            
            <!-- Battery & Signal -->
            <div class="node-sensor-card">
                <div class="sensor-title">
                    <i class="fas fa-battery-half"></i>
                    <span>Power & Signal</span>
                </div>
                <div class="sensor-value">${node.soc.toFixed(0)}% / ${node.rssi}dBm</div>
                <div class="sensor-detail">SOC / RSSI</div>
                <div class="sensor-status ${node.soc > 30 ? 'normal' : 'alert'}">
                    ${node.soc > 30 ? 'OK' : 'LOW'}
                </div>
            </div>
        </div>
    `;
}

/**
 * Update node level indicator
 */
function updateNodeLevel(node) {
    const levelContainer = document.getElementById('nodeLevelIndicator');
    if (!levelContainer) return;
    
    const fireStage = getFireStageClass(node.riskScore);
    let levelHTML = '';
    
    switch(fireStage.name) {
        case 'NORMAL':
            levelHTML = '<div class="level-indicator level-normal">🟢 NORMAL</div>';
            break;
        case 'ALERT':
            levelHTML = '<div class="level-indicator level-alert">🟡 ALERT</div>';
            break;
        case 'ELEVATED':
            levelHTML = '<div class="level-indicator level-elevated">🟠 ELEVATED</div>';
            break;
        case 'CRITICAL':
            levelHTML = '<div class="level-indicator level-critical blinking">🔴 CRITICAL</div>';
            break;
        case 'RAIN':
            levelHTML = '<div class="level-indicator level-rain">🔵 RAIN</div>';
            break;
    }
    
    levelContainer.innerHTML = levelHTML;
}

/**
 * Update overall dashboard summary
 */
function updateDashboardSummary() {
    const summaryContainer = document.getElementById('overallSummary');
    if (!summaryContainer) return;
    
    // Calculate aggregates from nodes
    const onlineNodes = Object.values(nodesData).filter(n => n.online);
    
    if (onlineNodes.length === 0) {
        summaryContainer.innerHTML = '<p class="no-data">No online nodes available</p>';
        return;
    }
    
    // Calculate averages
    const avgTemp = onlineNodes.reduce((sum, n) => sum + n.tempFused, 0) / onlineNodes.length;
    const avgHumidity = onlineNodes.reduce((sum, n) => sum + n.humidityFused, 0) / onlineNodes.length;
    const avgPressure = onlineNodes.reduce((sum, n) => sum + n.pressureFused, 0) / onlineNodes.length;
    const avgGasRatio = onlineNodes.reduce((sum, n) => sum + n.gasRatio, 0) / onlineNodes.length;
    const avgRisk = onlineNodes.reduce((sum, n) => sum + n.riskScore, 0) / onlineNodes.length;
    const avgSOC = onlineNodes.reduce((sum, n) => sum + n.soc, 0) / onlineNodes.length;
    
    const avgTempRate = onlineNodes.reduce((sum, n) => sum + n.tempRate, 0) / onlineNodes.length;
    const avgHumidityRate = onlineNodes.reduce((sum, n) => sum + n.humidityRate, 0) / onlineNodes.length;
    const avgGasRate = onlineNodes.reduce((sum, n) => sum + n.gasRate, 0) / onlineNodes.length;
    const windSpeed = aggregateData.windSpeed || 0;
    
    const systemFireStage = getFireStageClass(avgRisk);
    
    // Count stages
    const stageCounts = {
        normal: 0,
        alert: 0,
        elevated: 0,
        critical: 0
    };
    
    onlineNodes.forEach(node => {
        const stage = getFireStageClass(node.riskScore);
        stageCounts[stage.name.toLowerCase()]++;
    });
    
    summaryContainer.innerHTML = `
        <div class="summary-header">
            <h3>🌍 Overall System Summary</h3>
            <span class="summary-timestamp">${formatTime(new Date())}</span>
        </div>
        
        <div class="summary-grid">
            <!-- Rate Parameters -->
            <div class="summary-section">
                <h4>📊 Rate Parameters</h4>
                <div class="summary-items">
                    <div class="summary-item">
                        <span class="label">Temp Rate Avg</span>
                        <span class="value">${avgTempRate.toFixed(2)}°C/min</span>
                        <span class="status-small ${getRateStatus('tempRate', avgTempRate).class}">
                            ${getRateStatus('tempRate', avgTempRate).text}
                        </span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Humidity Rate Avg</span>
                        <span class="value">${avgHumidityRate.toFixed(2)}%/min</span>
                        <span class="status-small ${getRateStatus('humidityRate', avgHumidityRate).class}">
                            ${getRateStatus('humidityRate', avgHumidityRate).text}
                        </span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Gas Rate Avg</span>
                        <span class="value">${avgGasRate.toFixed(0)}Ω/min</span>
                        <span class="status-small ${getRateStatus('gasRate', avgGasRate).class}">
                            ${getRateStatus('gasRate', avgGasRate).text}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Environmental Parameters -->
            <div class="summary-section">
                <h4>🌡️ Environmental Parameters</h4>
                <div class="summary-items">
                    <div class="summary-item">
                        <span class="label">Temp Avg</span>
                        <span class="value">${avgTemp.toFixed(1)}°C</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Humidity Avg</span>
                        <span class="value">${avgHumidity.toFixed(1)}%</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Pressure Avg</span>
                        <span class="value">${avgPressure.toFixed(2)} hPa</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Wind Speed</span>
                        <span class="value">${windSpeed.toFixed(2)} m/s</span>
                        <span class="status-small ${getRateStatus('windSpeed', windSpeed).class}">
                            ${getRateStatus('windSpeed', windSpeed).text}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- System Health -->
            <div class="summary-section">
                <h4>💪 System Health</h4>
                <div class="summary-items">
                    <div class="summary-item">
                        <span class="label">Risk Avg</span>
                        <span class="value">${avgRisk.toFixed(1)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">SOC Avg</span>
                        <span class="value">${avgSOC.toFixed(1)}%</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Online Nodes</span>
                        <span class="value">${onlineNodes.length}/${CONFIG.NODE_COUNT}</span>
                    </div>
                </div>
            </div>
            
            <!-- Fire Detection -->
            <div class="summary-section fire-detection">
                <h4>🔥 Fire Detection Status</h4>
                <div class="fire-status-indicator ${systemFireStage.class}">
                    <div class="fire-status-value">${systemFireStage.name}</div>
                    <div class="fire-status-range">Risk: ${avgRisk.toFixed(1)}</div>
                </div>
                <div class="stage-breakdown">
                    <div class="stage-count normal">🟢 Normal: ${stageCounts.normal}</div>
                    <div class="stage-count alert">🟡 Alert: ${stageCounts.alert}</div>
                    <div class="stage-count elevated">🟠 Elevated: ${stageCounts.elevated}</div>
                    <div class="stage-count critical">🔴 Critical: ${stageCounts.critical}</div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// MAIN UPDATE FUNCTIONS
// ============================================

/**
 * Update entire dashboard
 */
async function updateDashboard() {
    // Fetch live data or use simulation
    if (API_CONFIG.ENABLE_LIVE_DATA) {
        const success = await updateDashboardDataFromAPI();
        if (!success) {
            // Fallback to simulation
            for (let i = 1; i <= CONFIG.NODE_COUNT; i++) {
                generateSimulatedNodeData(i);
            }
        }
    } else {
        // Use simulated data
        for (let i = 1; i <= CONFIG.NODE_COUNT; i++) {
            generateSimulatedNodeData(i);
        }
    }
    
    // Update tab status indicators
    updateTabStatusIndicators();
    
    // Update active node dashboard
    updateNodeDashboard(currentActiveNode);
    
    // Update overall summary
    updateDashboardSummary();
    
    console.log(`✓ Dashboard updated at ${formatTime(new Date())}`);
}

/**
 * Update tab status indicators
 */
function updateTabStatusIndicators() {
    for (let i = 1; i <= CONFIG.NODE_COUNT; i++) {
        const node = nodesData[i];
        const indicator = document.getElementById(`nodeStatus${i}`);
        
        if (indicator) {
            if (!node.online) {
                indicator.textContent = '⭕';
                indicator.style.color = '#999';
            } else {
                const fireStage = getFireStageClass(node.riskScore);
                switch(fireStage.name) {
                    case 'CRITICAL':
                        indicator.textContent = '🔴';
                        break;
                    case 'ELEVATED':
                        indicator.textContent = '🟠';
                        break;
                    case 'ALERT':
                        indicator.textContent = '🟡';
                        break;
                    default:
                        indicator.textContent = '🟢';
                }
            }
        }
    }
}

let wsConnection = null;

function connectWebSocket() {
    try {
        wsConnection = new WebSocket(API_CONFIG.WS_URL);
        
        wsConnection.onopen = () => {
            console.log('✅ WebSocket connected to backend');
        };
        
        wsConnection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.node) {
                    const node = data.node;
                    if (node.nodeId && nodesData[node.nodeId]) {
                        nodesData[node.nodeId] = {
                            ...nodesData[node.nodeId],
                            ...node,
                            timestamp: new Date(node.timestamp)
                        };
                        updateTabStatusIndicators();
                        if (node.nodeId === currentActiveNode) {
                            updateNodeDashboard(currentActiveNode);
                        }
                    }
                }
            } catch (e) {
                console.error('WebSocket message error:', e);
            }
        };
        
        wsConnection.onclose = () => {
            console.log('WebSocket disconnected, reconnecting in 5s...');
            setTimeout(connectWebSocket, 5000);
        };
        
        wsConnection.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
        
    } catch (err) {
        console.error('WebSocket connection failed:', err);
    }
}
/**
 * Start dashboard
 */
async function startDashboard() {
    console.log('🔥 Starting multi-node dashboard...');
    console.log(`📡 Live data: ${API_CONFIG.ENABLE_LIVE_DATA ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🖥️ Monitoring ${CONFIG.NODE_COUNT} nodes`);
    
    // Initialize tabs
    initializeNodeTabs();
    
    // Connect WebSocket for real-time updates
    connectWebSocket();
    
    // Initial update
    await updateDashboard();
    
    // Set up interval for updates
    dashboardInterval = setInterval(async () => {
        await updateDashboard();
    }, API_CONFIG.FETCH_INTERVAL);
    
    console.log(`⏱️ Update interval: ${API_CONFIG.FETCH_INTERVAL}ms`);
}

/**
 * Stop dashboard
 */
function stopDashboard() {
    if (dashboardInterval) {
        clearInterval(dashboardInterval);
        dashboardInterval = null;
    }
}

/**
 * Manual refresh
 */
async function manualRefresh() {
    console.log('🔄 Manual refresh triggered');
    await updateDashboard();
}

// ============================================
// NAVIGATION AND UI FUNCTIONS
// ============================================

/**
 * Initialize navigation
 */
function initNavigation() {
    const mobileMenu = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (mobileMenu && navMenu) {
        mobileMenu.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerHeight = 80;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                if (navMenu.classList.contains('active')) {
                    mobileMenu.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            }
        });
    });
    
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
        });
    }
}

/**
 * Initialize scroll animations
 */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    const animatedElements = document.querySelectorAll('.tech-card, .use-case-card, .step-card, .sensor-card');
    animatedElements.forEach((el, index) => {
        el.classList.add('fade-in');
        el.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(el);
    });
}

/**
 * Initialize cookie consent
 */
function initCookieConsent() {
    const cookieBanner = document.getElementById('cookieConsent');
    const acceptBtn = document.getElementById('acceptCookies');
    const declineBtn = document.getElementById('declineCookies');
    
    const cookieChoice = window.cookieConsentChoice;
    
    if (!cookieChoice) {
        setTimeout(() => {
            if (cookieBanner) {
                cookieBanner.classList.add('show');
            }
        }, 2000);
    }
    
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            window.cookieConsentChoice = 'accepted';
            if (cookieBanner) {
                cookieBanner.classList.remove('show');
            }
        });
    }
    
    if (declineBtn) {
        declineBtn.addEventListener('click', () => {
            window.cookieConsentChoice = 'declined';
            if (cookieBanner) {
                cookieBanner.classList.remove('show');
            }
        });
    }
}

/**
 * Initialize contact form
 */
function initContactForm() {
    const form = document.querySelector('.contact-form');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const name = formData.get('name');
            const email = formData.get('email');
            const message = formData.get('message');
            
            if (!name || !email || !message) {
                alert('Please fill in all fields.');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Please enter a valid email address.');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            
            setTimeout(() => {
                alert('Thank you for your message! This is a demonstration - no email was actually sent.');
                form.reset();
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 1500);
        });
    }
}

// ============================================
// PAGE LOAD AND INITIALIZATION
// ============================================

/**
 * Initialize all components
 */
function init() {
    console.log('🔥 WildFire AI Detection System - Multi-Node Initialized');
    
    initNavigation();
    initScrollAnimations();
    initCookieConsent();
    initContactForm();
    startDashboard();
    
    console.log('🚀 All systems operational!');
}

/**
 * Cleanup
 */
function cleanup() {
    stopDashboard();
    console.log('🔄 Dashboard stopped');
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Cleanup on unload
window.addEventListener('beforeunload', cleanup);

// Handle visibility
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (!dashboardInterval) {
            startDashboard();
            console.log('📊 Dashboard resumed');
        }
    } else {
        stopDashboard();
        console.log('⏸️ Dashboard paused');
    }
});

// Export for debugging
window.WildFireAI = {
    nodesData,
    aggregateData,
    currentActiveNode,
    switchNode,
    updateDashboard,
    CONFIG
};

console.log('🔧 Debug tools available at window.WildFireAI');