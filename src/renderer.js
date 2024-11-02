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

// Update text sizes for welcome screen
nameInput.style.fontSize = '2rem';
nameInput.style.padding = '1.2rem';
nameSubmit.style.fontSize = '2rem';
nameSubmit.style.padding = '1.2rem 2.5rem';

document.querySelector('.theme-section h2').style.fontSize = '2.5rem';
themeSubmit.style.fontSize = '2rem';
themeSubmit.style.padding = '1.2rem 2.5rem';

// Theme images mapping
const themeImages = {
    'harry-potter': path.join(__dirname, '../assets/harry.jpg'),
    'marvel': path.join(__dirname, '../assets/marvel.png'),
    'mickey': path.join(__dirname, '../assets/mickey.jpg'),
    'spiderman': path.join(__dirname, '../assets/spiderman.jpg'),
    'tangled': path.join(__dirname, '../assets/tangled.jpg')
};

// Set theme preview images
themeBoxes.forEach(box => {
  const theme = box.dataset.theme;
  const img = box.querySelector('img');
  if (img && themeImages[theme]) {
    img.src = themeImages[theme];
    img.style.width = '100%';
    img.style.height = '200px'; // Increased image size
    img.style.objectFit = 'cover';
  }
});

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
  const personalizedTitle = `${userName.toUpperCase()}'S PERSONAL PC`;
  headerName.textContent = personalizedTitle;
  
  // Update this section to properly set the background
  document.body.style.backgroundImage = `url('${themeImages[selectedTheme]}')`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundRepeat = 'no-repeat';
  document.body.style.height = '100vh';
  document.body.style.margin = '0';
  
  // Add this to ensure the canvas container is transparent
  canvasContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  
  initializeSVG();
  addArrowMarker();
  initializeHomeButton();
  initializePanAndZoom();
  loadFolderTree(homePath, 0, initializeHomeButton(), 0);
}
const treeContainer = document.getElementById('tree-container');
const homePath = os.homedir();

const folderState = {};
let isPanning = false;
let startX = 0;
let startY = 0;
let currentScale = 1;
let lastDistance = 0;

// Updated dimensions and spacing
const INITIAL_VIEW_WIDTH = 16000;
const INITIAL_VIEW_HEIGHT = 12000;
const NODE_WIDTH = 2400;
const NODE_HEIGHT = 1000;
const NODE_PADDING = 600;
const HORIZONTAL_SPACING = 4000;
const VERTICAL_SPACING = 2500;
const RADIAL_RADIUS = 8000;
const SECOND_LAYER_OFFSET = 6000;

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

function fitTextInNode(text, maxWidth) {
    const maxChars = Math.floor(maxWidth / 150);
    if (text.length <= maxChars) return text;
    
    const parts = text.split('.');
    if (parts.length > 1) {
        const ext = parts.pop();
        const name = parts.join('.');
        if (name.length > maxChars - 4) {
            return `${name.substring(0, maxChars - 4)}...${ext}`;
        }
        return text;
    }
    
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

    const fittedText = fitTextInNode(item.name, NODE_WIDTH - NODE_PADDING);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('class', 'node-text');
    text.textContent = fittedText;
    text.style.fill = '#FFFFFF';
    text.style.fontSize = '250px';
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

  // Pan functionality
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

  // Pinch zoom functionality
  treeContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          lastDistance = Math.hypot(
              touch2.clientX - touch1.clientX,
              touch2.clientY - touch1.clientY
          );
      }
  }, { passive: false });

  treeContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const currentDistance = Math.hypot(
              touch2.clientX - touch1.clientX,
              touch2.clientY - touch1.clientY
          );

          if (lastDistance > 0) {
              const delta = currentDistance - lastDistance;
              const zoomFactor = 1 + delta * 0.01;

              // Calculate center of pinch
              const centerX = (touch1.clientX + touch2.clientX) / 2;
              const centerY = (touch1.clientY + touch2.clientY) / 2;

              // Convert center point to SVG coordinates
              const svgPoint = treeContainer.createSVGPoint();
              svgPoint.x = centerX;
              svgPoint.y = centerY;
              const transformedPoint = svgPoint.matrixTransform(treeContainer.getScreenCTM().inverse());

              // Update viewBox
              viewBox.w /= zoomFactor;
              viewBox.h /= zoomFactor;
              viewBox.x += (transformedPoint.x - viewBox.x) * (1 - 1/zoomFactor);
              viewBox.y += (transformedPoint.y - viewBox.y) * (1 - 1/zoomFactor);

              treeContainer.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
          }

          lastDistance = currentDistance;
      }
  }, { passive: false });

  treeContainer.addEventListener('touchend', () => {
      lastDistance = 0;
  });

  // Mouse wheel zoom
  treeContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      if (e.ctrlKey) {
          const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

          // Calculate mouse position in SVG coordinates
          const svgPoint = treeContainer.createSVGPoint();
          svgPoint.x = e.clientX;
          svgPoint.y = e.clientY;
          const transformedPoint = svgPoint.matrixTransform(treeContainer.getScreenCTM().inverse());

          // Update viewBox
          viewBox.w *= zoomFactor;
          viewBox.h *= zoomFactor;
          viewBox.x += (transformedPoint.x - viewBox.x) * (1 - zoomFactor);
          viewBox.y += (transformedPoint.y - viewBox.y) * (1 - zoomFactor);

          treeContainer.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
      } else {
          // Pan with non-ctrl wheel events
          const scrollSpeed = 1.5;
          viewBox.x += e.deltaX * scrollSpeed;
          viewBox.y += e.deltaY * scrollSpeed;
          
          treeContainer.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
      }
  }, { passive: false });
}
