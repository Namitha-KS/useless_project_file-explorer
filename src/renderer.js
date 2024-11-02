const { ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

let userName = '';
let selectedTheme = '';

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const fileExplorer = document.getElementById('file-explorer');
const nameInput = document.getElementById('user-name');
const nameSubmit = document.getElementById('name-submit');
const themeSection = document.getElementById('theme-section');
const themeSubmit = document.getElementById('theme-submit');
const headerName = document.getElementById('header-name');
const themeBoxes = document.querySelectorAll('.theme-box');
const canvasContainer = document.getElementById('canvas-container');

// Welcome screen logic
nameSubmit.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (name) {
    userName = name;
    nameInput.parentElement.classList.add('hidden');
    themeSection.classList.remove('hidden');
  }
});

themeBoxes.forEach(box => {
  box.addEventListener('click', () => {
    themeBoxes.forEach(b => b.classList.remove('selected'));
    box.classList.add('selected');
    selectedTheme = box.dataset.theme;
    themeSubmit.classList.remove('hidden');
  });
});

themeSubmit.addEventListener('click', () => {
  if (selectedTheme) {
    welcomeScreen.classList.add('hidden');
    fileExplorer.classList.remove('hidden');
    initializeFileExplorer();
  }
});

function initializeFileExplorer() {
  // Update the header with personalized title
  const personalizedTitle = `${userName.toUpperCase()}'S PERSONAL PC`;
  headerName.textContent = personalizedTitle;
  
  canvasContainer.classList.add(`theme-${selectedTheme}`);
  initializeSVG();
  addArrowMarker();
  initializeHomeButton();
  initializePanAndZoom();
  loadFolderTree(homePath, 0, initializeHomeButton(), 0);
}


const treeContainer = document.getElementById('tree-container');
const svgContainer = document.getElementById('svg-container');
const homePath = os.homedir();

const folderState = {};
let isPanning = false;
let startX = 0;
let startY = 0;

// Updated dimensions and spacing
const INITIAL_VIEW_WIDTH = 16000;  // Increased for better overall view
const INITIAL_VIEW_HEIGHT = 12000; // Increased for better overall view
const NODE_WIDTH = 2400;           // Slightly wider for text
const NODE_HEIGHT = 1000;          // Slightly taller for text
const NODE_PADDING = 600;
const HORIZONTAL_SPACING = 4000;    // Increased horizontal spacing
const VERTICAL_SPACING = 2500;      // Increased vertical spacing
const RADIAL_RADIUS = 8000;        // Adjusted for new spacing
const SECOND_LAYER_OFFSET = 6000;   // Adjusted for new spacing

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

// Added function to fit text within node
function fitTextInNode(text, maxWidth) {
    const maxChars = Math.floor(maxWidth / 150); // Approximate characters that fit
    if (text.length <= maxChars) return text;
    
    // If filename has extension, keep it in shortened form
    const parts = text.split('.');
    if (parts.length > 1) {
        const ext = parts.pop();
        const name = parts.join('.');
        if (name.length > maxChars - 4) { // Account for "..." and extension
            return `${name.substring(0, maxChars - 4)}...${ext}`;
        }
        return text;
    }
    
    // For folders or files without extension
    return text.substring(0, maxChars - 3) + '...';
}

function drawNode(item, x, y, parentPath, depth) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'node-group');

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

    // Fit text within node
    const fittedText = fitTextInNode(item.name, NODE_WIDTH - NODE_PADDING);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('class', 'node-text');
    text.textContent = fittedText;
    text.style.fill = '#FFFFFF';
    text.style.fontSize = '250px'; // Slightly smaller font for better fit
    text.style.fontWeight = 'bold';
    text.style.pointerEvents = 'none';

    group.appendChild(button);
    group.appendChild(text);
    
    group.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.isDirectory) {
            const fullPath = path.join(parentPath, item.name);
            folderState[fullPath] = !folderState[fullPath];
            treeContainer.innerHTML = '';
            addArrowMarker();
            initializeHomeButton();
            loadFolderTree(homePath, 0, 0, 0);
        } else {
            const fullPath = path.join(parentPath, item.name);
            exec(`"${fullPath}"`);
        }
    });

    treeContainer.appendChild(group);
    return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

function drawCurvedLineWithArrow(x1, y1, x2, y2) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    // Adjusted control points for smoother curves with new spacing
    const controlX1 = x1 + dx * 0.6;
    const controlY1 = y1 + dy * 0.2;
    const controlX2 = x1 + dx * 0.4;
    const controlY2 = y2 - dy * 0.2;
    
    path.setAttribute('d', `M ${x1},${y1} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${x2},${y2}`);
    path.setAttribute('class', 'connection-line');
    path.setAttribute('marker-end', 'url(#arrow)');
    path.style.stroke = '#2C3E50';
    path.style.strokeWidth = '6';
    path.style.fill = 'none';

    treeContainer.appendChild(path);
}

function initializeHomeButton() {
    const buttonWidth = 2400; // Match node width
    const buttonHeight = 1000; // Match node height
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

async function loadFolderTree(folderPath, x, y, depth = 0, direction = 'right') {
    try {
        const items = await ipcRenderer.invoke('get-folder-contents', folderPath);
        const visibleItems = items.filter(item => !item.name.startsWith('.'));

        if (visibleItems.length === 0) return;

        if (depth === 0) {
            drawNode({ name: 'Home', isDirectory: true }, x, y, folderPath, depth);
            
            const leftItems = visibleItems.slice(0, visibleItems.length / 2);
            const rightItems = visibleItems.slice(visibleItems.length / 2);
            
            let leftY = y - (leftItems.length * VERTICAL_SPACING) / 2;
            leftItems.forEach((item, index) => {
                const nodeX = x - HORIZONTAL_SPACING;
                const nodeY = leftY + (index * VERTICAL_SPACING);
                
                drawCurvedLineWithArrow(x, y, nodeX, nodeY);
                drawNode(item, nodeX, nodeY, folderPath, depth);
                
                if (item.isDirectory && folderState[path.join(folderPath, item.name)]) {
                    loadFolderTree(path.join(folderPath, item.name), nodeX, nodeY, depth + 1, 'left');
                }
            });
            
            let rightY = y - (rightItems.length * VERTICAL_SPACING) / 2;
            rightItems.forEach((item, index) => {
                const nodeX = x + HORIZONTAL_SPACING;
                const nodeY = rightY + (index * VERTICAL_SPACING);
                
                drawCurvedLineWithArrow(x, y, nodeX, nodeY);
                drawNode(item, nodeX, nodeY, folderPath, depth);
                
                if (item.isDirectory && folderState[path.join(folderPath, item.name)]) {
                    loadFolderTree(path.join(folderPath, item.name), nodeX, nodeY, depth + 1, 'right');
                }
            });
        } else {
            const verticalSpacing = VERTICAL_SPACING * 0.9; // Slightly reduced spacing for sub-levels
            const horizontalOffset = HORIZONTAL_SPACING * 0.9; // Slightly reduced horizontal spacing
            
            const startY = y - ((visibleItems.length - 1) * verticalSpacing) / 2;
            
            visibleItems.forEach((item, index) => {
                const nodeX = direction === 'left' ? x - horizontalOffset : x + horizontalOffset;
                const nodeY = startY + (index * verticalSpacing);
                
                drawCurvedLineWithArrow(x, y, nodeX, nodeY);
                drawNode(item, nodeX, nodeY, folderPath, depth);
                
                if (item.isDirectory && folderState[path.join(folderPath, item.name)]) {
                    loadFolderTree(path.join(folderPath, item.name), nodeX, nodeY, depth + 1, direction);
                }
            });
        }
    } catch (error) {
        console.error('Error loading folder:', error);
    }
}

// Pan and zoom functionality
function initializePanAndZoom() {
  let viewBox = { 
      x: -INITIAL_VIEW_WIDTH / 2, 
      y: -INITIAL_VIEW_HEIGHT / 2, 
      w: INITIAL_VIEW_WIDTH, 
      h: INITIAL_VIEW_HEIGHT 
  };

  // Pan functionality remains the same
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

  // Replace wheel zoom with two-finger scroll
  treeContainer.addEventListener('wheel', (e) => {
      e.preventDefault();

      // Check if it's a two-finger gesture (trackpad)
      if (e.ctrlKey || e.deltaMode === 0) {
          const scrollSpeed = 1.5; // Adjust this value to control scroll speed
          viewBox.x += e.deltaX * scrollSpeed;
          viewBox.y += e.deltaY * scrollSpeed;
          
          treeContainer.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
      }
  }, { passive: false });
}
