const { ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const treeContainer = document.getElementById('tree-container');
const svgContainer = document.getElementById('svg-container');
const homePath = os.homedir();


const folderState = {};
let isPanning = false;
let startX = 0;
let startY = 0;

const INITIAL_VIEW_WIDTH = 12000;  
const INITIAL_VIEW_HEIGHT = 8000;  
const NODE_WIDTH = 2000;
const NODE_HEIGHT = 800;
const NODE_PADDING = 400;
const HORIZONTAL_SPACING = 2500;
const VERTICAL_SPACING = 1500;
const RADIAL_RADIUS = 6000;  
const SECOND_LAYER_OFFSET = 4000; 

let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxY = -Infinity;

function initializeSVG() {
    const centerX = INITIAL_VIEW_WIDTH / 2;
    const centerY = INITIAL_VIEW_HEIGHT / 2;
    treeContainer.setAttribute('viewBox', `${-centerX} ${-centerY} ${INITIAL_VIEW_WIDTH} ${INITIAL_VIEW_HEIGHT}`);
    treeContainer.setAttribute('width', '100%');
    treeContainer.setAttribute('height', '100%');
}

// Pan and zoom functionality
function initializePanAndZoom() {
    let viewBox = { 
        x: -INITIAL_VIEW_WIDTH / 2, 
        y: -INITIAL_VIEW_HEIGHT / 2, 
        w: INITIAL_VIEW_WIDTH, 
        h: INITIAL_VIEW_HEIGHT 
    };

    treeContainer.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isPanning = true;
            startX = e.clientX;
            startY = e.clientY;
            treeContainer.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;

        const dx = (e.clientX - startX) * (viewBox.w / treeContainer.clientWidth);
        const dy = (e.clientY - startY) * (viewBox.h / treeContainer.clientHeight);

        viewBox.x -= dx;
        viewBox.y -= dy;

        treeContainer.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);

        startX = e.clientX;
        startY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        treeContainer.style.cursor = 'grab';
    });

    treeContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scale = e.deltaY > 0 ? 1.1 : 0.9;

        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const point = treeContainer.createSVGPoint();
        point.x = mouseX;
        point.y = mouseY;
        const svgPoint = point.matrixTransform(treeContainer.getScreenCTM().inverse());

        viewBox.w *= scale;
        viewBox.h *= scale;
        viewBox.x = svgPoint.x - (svgPoint.x - viewBox.x) * scale;
        viewBox.y = svgPoint.y - (svgPoint.y - viewBox.y) * scale;

        treeContainer.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    }, { passive: false });
}

function drawNode(item, x, y, parentPath, depth) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'node-group');

    // Create button background (rectangle)
    const button = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    button.setAttribute('x', x - NODE_WIDTH / 2);
    button.setAttribute('y', y - NODE_HEIGHT / 2);
    button.setAttribute('width', NODE_WIDTH);
    button.setAttribute('height', NODE_HEIGHT);
    button.setAttribute('rx', '20');
    button.setAttribute('ry', '20');
    button.setAttribute('class', 'node-button');
    button.style.fill = item.isDirectory ? '#4A90E2' : '#67C23A';
    button.style.stroke = '#2C3E50';
    button.style.strokeWidth = '4';
    button.style.cursor = 'pointer';

    // Create text label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('class', 'node-text');
    text.textContent = item.name;
    text.style.fill = '#FFFFFF';
    text.style.fontSize = '300px';
    text.style.fontWeight = 'bold';
    text.style.pointerEvents = 'none';

    // Add click handler
    group.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.isDirectory) {
            const fullPath = path.join(parentPath, item.name);
            folderState[fullPath] = !folderState[fullPath];
            treeContainer.innerHTML = '';
            addArrowMarker();
            initializeHomeButton();
            loadFolderTree(homePath, 0, initializeHomeButton(), 0);
        } else {
            const fullPath = path.join(parentPath, item.name);
            exec(`"${fullPath}"`);
        }
    });

    group.appendChild(button);
    group.appendChild(text);
    treeContainer.appendChild(group);

    return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

function drawCurvedLineWithArrow(x1, y1, x2, y2) {
    const midY = (y1 + y2) / 2;
    const controlPoint1 = { x: x1, y: midY };
    const controlPoint2 = { x: x2, y: midY };

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1},${y1} C ${controlPoint1.x},${controlPoint1.y} ${controlPoint2.x},${controlPoint2.y} ${x2},${y2}`);
    path.setAttribute('class', 'connection-line');
    path.setAttribute('marker-end', 'url(#arrow)');
    path.style.stroke = '#2C3E50';
    path.style.strokeWidth = '6';
    path.style.fill = 'none';

    treeContainer.appendChild(path);
}

// async function loadFolderTree(folderPath, x, y, depth = 0) {
//     try {
//         const items = await ipcRenderer.invoke('get-folder-contents', folderPath);
//         const visibleItems = items.filter(item => !item.name.startsWith('.'));

//         if (visibleItems.length === 0) return;

//         if (depth === 0) {
//             // First level: Radial layout
//             const angleStep = (2 * Math.PI) / visibleItems.length;
//             visibleItems.forEach((item, index) => {
//                 const angle = index * angleStep - Math.PI / 2;
//                 const nodeX = x + RADIAL_RADIUS * Math.cos(angle);
//                 const nodeY = y + RADIAL_RADIUS * Math.sin(angle);

//                 drawCurvedLineWithArrow(x, y, nodeX, nodeY);
//                 drawNode(item, nodeX, nodeY, folderPath, depth);

//                 if (item.isDirectory && folderState[path.join(folderPath, item.name)]) {
//                     loadFolderTree(path.join(folderPath, item.name), nodeX, nodeY, depth + 1);
//                 }
//             });
//         } else {
//             // Subsequent levels: Vertical tree layout
//             const totalWidth = visibleItems.length * (NODE_WIDTH + HORIZONTAL_SPACING) - HORIZONTAL_SPACING;
//             let currentX = x - totalWidth / 2;

//             for (const item of visibleItems) {
//                 const nodeX = currentX + NODE_WIDTH / 2;
//                 const nodeY = y + VERTICAL_SPACING;

//                 drawCurvedLineWithArrow(x, y, nodeX, nodeY);
//                 drawNode(item, nodeX, nodeY, folderPath, depth);

//                 if (item.isDirectory && folderState[path.join(folderPath, item.name)]) {
//                     await loadFolderTree(path.join(folderPath, item.name), nodeX, nodeY, depth + 1);
//                 }

//                 currentX += NODE_WIDTH + HORIZONTAL_SPACING;
//             }
//         }

//     } catch (error) {
//         console.error('Error loading folder:', error);
//     }
// }

function initializeHomeButton() {
    const buttonWidth = 2000;
    const buttonHeight = 800;
    const centerX = 0;
    const centerY = -INITIAL_VIEW_HEIGHT / 3;

    const homeButton = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const buttonRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    buttonRect.setAttribute('x', centerX - buttonWidth / 2);
    buttonRect.setAttribute('y', centerY - buttonHeight / 2);
    buttonRect.setAttribute('width', buttonWidth);
    buttonRect.setAttribute('height', buttonHeight);
    buttonRect.setAttribute('rx', '20');
    buttonRect.setAttribute('ry', '20');
    buttonRect.style.fill = '#E74C3C';
    buttonRect.style.stroke = '#C0392B';
    buttonRect.style.strokeWidth = '4';
    buttonRect.style.cursor = 'pointer';

    const buttonText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    buttonText.setAttribute('x', centerX);
    buttonText.setAttribute('y', centerY);
    buttonText.setAttribute('text-anchor', 'middle');
    buttonText.setAttribute('dominant-baseline', 'middle');
    buttonText.style.fill = '#FFFFFF';
    buttonText.style.fontSize = '300px';
    buttonText.style.fontWeight = 'bold';
    buttonText.textContent = '🏠 Home';

    homeButton.appendChild(buttonRect);
    homeButton.appendChild(buttonText);
    
    homeButton.addEventListener('click', () => {
        treeContainer.innerHTML = '';
        addArrowMarker();
        initializeHomeButton();
        loadFolderTree(homePath, 0, centerY + VERTICAL_SPACING, 0);
    });

    treeContainer.appendChild(homeButton);
    return centerY + VERTICAL_SPACING;
}

function addArrowMarker() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.style.fill = '#2C3E50';

    marker.appendChild(path);
    defs.appendChild(marker);
    treeContainer.appendChild(defs);
}

async function loadFolderTree(folderPath, x, y, depth = 0) {
    try {
        const items = await ipcRenderer.invoke('get-folder-contents', folderPath);
        const visibleItems = items.filter(item => !item.name.startsWith('.'));

        if (visibleItems.length === 0) return;

        if (depth === 0) {
            const angleStep = (2 * Math.PI) / visibleItems.length;
            visibleItems.forEach((item, index) => {
                const angle = index * angleStep - Math.PI / 2;
                const nodeX = x + RADIAL_RADIUS * Math.cos(angle);
                const nodeY = y + RADIAL_RADIUS * Math.sin(angle);

                drawCurvedLineWithArrow(x, y, nodeX, nodeY);
                drawNode(item, nodeX, nodeY, folderPath, depth);

                if (item.isDirectory && folderState[path.join(folderPath, item.name)]) {
                    loadFolderTree(path.join(folderPath, item.name), nodeX, nodeY, depth + 1);
                }
            });
        } else {
            const startX = x + SECOND_LAYER_OFFSET;  // Start from the right side of parent
            const verticalSpacing = NODE_HEIGHT * 1.5;  // Space between siblings
            const totalHeight = visibleItems.length * verticalSpacing;
            let currentY = y - totalHeight / 2;  // Center align children vertically

            for (const item of visibleItems) {
                const nodeX = startX;
                const nodeY = currentY;

                drawCurvedLineWithArrow(x, y, nodeX, nodeY);
                drawNode(item, nodeX, nodeY, folderPath, depth);

                if (item.isDirectory && folderState[path.join(folderPath, item.name)]) {
                    await loadFolderTree(path.join(folderPath, item.name), nodeX, nodeY, depth + 1);
                }

                currentY += verticalSpacing;
            }
        }

    } catch (error) {
        console.error('Error loading folder:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeSVG();
    addArrowMarker();
    initializeHomeButton();
    initializePanAndZoom();
    loadFolderTree(homePath, 0, initializeHomeButton(), 0);
});