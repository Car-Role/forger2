// ScrollablePanel - A reusable scrollable container for UI elements
export class ScrollablePanel {
  constructor(scene, config) {
    this.scene = scene;
    
    // Panel configuration
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.width = config.width || 200;
    this.height = config.height || 300;
    this.padding = config.padding || 10;
    this.backgroundColor = config.backgroundColor || 0x2a2a3a;
    this.backgroundAlpha = config.backgroundAlpha || 0.95;
    this.borderColor = config.borderColor || 0x4a4a6a;
    this.borderWidth = config.borderWidth || 2;
    this.scrollbarWidth = config.scrollbarWidth || 8;
    this.scrollbarColor = config.scrollbarColor || 0x6a6a8a;
    this.scrollbarTrackColor = config.scrollbarTrackColor || 0x3a3a5a;
    
    // Scroll state
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.contentHeight = 0;
    this.isDragging = false;
    this.dragStartY = 0;
    this.scrollStartY = 0;
    
    // Content items
    this.items = [];
    
    // Create the panel
    this.create();
  }
  
  create() {
    // Main container
    this.container = this.scene.add.container(this.x, this.y);
    this.container.setDepth(1000);
    
    // Background
    this.background = this.scene.add.rectangle(
      0, 0,
      this.width, this.height,
      this.backgroundColor, this.backgroundAlpha
    ).setOrigin(0);
    this.background.setStrokeStyle(this.borderWidth, this.borderColor);
    this.container.add(this.background);
    
    // Create mask for content clipping
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
      this.x + this.padding,
      this.y + this.padding,
      this.width - this.padding * 2 - this.scrollbarWidth - 4,
      this.height - this.padding * 2
    );
    this.mask = maskShape.createGeometryMask();
    
    // Content container (this gets scrolled)
    this.contentContainer = this.scene.add.container(this.padding, this.padding);
    this.contentContainer.setMask(this.mask);
    this.container.add(this.contentContainer);
    
    // Scrollbar track
    this.scrollbarTrack = this.scene.add.rectangle(
      this.width - this.scrollbarWidth - this.padding / 2,
      this.padding,
      this.scrollbarWidth,
      this.height - this.padding * 2,
      this.scrollbarTrackColor
    ).setOrigin(0);
    this.container.add(this.scrollbarTrack);
    
    // Scrollbar thumb
    this.scrollbarThumb = this.scene.add.rectangle(
      this.width - this.scrollbarWidth - this.padding / 2,
      this.padding,
      this.scrollbarWidth,
      50, // Will be resized based on content
      this.scrollbarColor
    ).setOrigin(0);
    this.scrollbarThumb.setInteractive({ useHandCursor: true });
    this.container.add(this.scrollbarThumb);
    
    // Set up scrollbar dragging
    this.scrollbarThumb.on('pointerdown', (pointer) => {
      this.isDraggingThumb = true;
      this.thumbDragStartY = pointer.y;
      this.thumbScrollStartY = this.scrollY;
    });
    
    this.scene.input.on('pointermove', (pointer) => {
      if (this.isDraggingThumb && this.container.visible) {
        const deltaY = pointer.y - this.thumbDragStartY;
        const scrollRatio = deltaY / (this.height - this.padding * 2 - this.scrollbarThumb.height);
        this.scrollY = this.thumbScrollStartY + scrollRatio * this.maxScrollY;
        this.clampScroll();
        this.updateContentPosition();
      }
    });
    
    this.scene.input.on('pointerup', () => {
      this.isDraggingThumb = false;
    });
    
    // Set up mouse wheel scrolling
    this.background.setInteractive();
    this.background.on('wheel', (pointer, dx, dy, dz) => {
      this.scrollY += dy * 0.5;
      this.clampScroll();
      this.updateContentPosition();
    });
    
    // Content area also scrollable
    this.contentContainer.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.width - this.padding * 2 - this.scrollbarWidth, this.height - this.padding * 2),
      Phaser.Geom.Rectangle.Contains
    );
    
    // Touch/drag scrolling
    this.contentContainer.on('pointerdown', (pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.scrollStartY = this.scrollY;
    });
    
    this.scene.input.on('pointermove', (pointer) => {
      if (this.isDragging && this.container.visible) {
        const deltaY = this.dragStartY - pointer.y;
        this.scrollY = this.scrollStartY + deltaY;
        this.clampScroll();
        this.updateContentPosition();
      }
    });
    
    this.scene.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }
  
  // Add a text item
  addText(text, style = {}) {
    const defaultStyle = {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      wordWrap: { width: this.width - this.padding * 2 - this.scrollbarWidth - 10 }
    };
    
    const textObj = this.scene.add.text(0, this.contentHeight, text, { ...defaultStyle, ...style });
    this.contentContainer.add(textObj);
    this.items.push(textObj);
    this.contentHeight += textObj.height + 5;
    this.updateScrollbar();
    return textObj;
  }
  
  // Add a button
  addButton(text, callback, style = {}) {
    const buttonWidth = style.width || this.width - this.padding * 2 - this.scrollbarWidth - 10;
    const buttonHeight = style.height || 30;
    
    const buttonContainer = this.scene.add.container(0, this.contentHeight);
    
    const bg = this.scene.add.rectangle(0, 0, buttonWidth, buttonHeight, style.bgColor || 0x4a4a6a)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    
    const label = this.scene.add.text(buttonWidth / 2, buttonHeight / 2, text, {
      fontSize: style.fontSize || '13px',
      fontFamily: 'Arial',
      color: style.color || '#ffffff'
    }).setOrigin(0.5);
    
    bg.on('pointerover', () => bg.setFillStyle(style.hoverColor || 0x5a5a7a));
    bg.on('pointerout', () => bg.setFillStyle(style.bgColor || 0x4a4a6a));
    bg.on('pointerdown', callback);
    
    buttonContainer.add([bg, label]);
    this.contentContainer.add(buttonContainer);
    this.items.push(buttonContainer);
    this.contentHeight += buttonHeight + 5;
    this.updateScrollbar();
    return buttonContainer;
  }
  
  // Add a custom game object
  addItem(gameObject, height) {
    gameObject.y = this.contentHeight;
    this.contentContainer.add(gameObject);
    this.items.push(gameObject);
    this.contentHeight += height + 5;
    this.updateScrollbar();
    return gameObject;
  }
  
  // Add spacing
  addSpacer(height = 10) {
    this.contentHeight += height;
    this.updateScrollbar();
  }
  
  // Add a horizontal divider
  addDivider(color = 0x4a4a6a) {
    const line = this.scene.add.rectangle(
      0, this.contentHeight + 5,
      this.width - this.padding * 2 - this.scrollbarWidth - 10, 1,
      color
    ).setOrigin(0);
    this.contentContainer.add(line);
    this.items.push(line);
    this.contentHeight += 12;
    this.updateScrollbar();
    return line;
  }
  
  // Clear all content
  clear() {
    this.items.forEach(item => item.destroy());
    this.items = [];
    this.contentHeight = 0;
    this.scrollY = 0;
    this.updateContentPosition();
    this.updateScrollbar();
  }
  
  // Update scrollbar size and position
  updateScrollbar() {
    const viewHeight = this.height - this.padding * 2;
    this.maxScrollY = Math.max(0, this.contentHeight - viewHeight);
    
    // Calculate thumb size
    const thumbHeight = Math.max(20, (viewHeight / this.contentHeight) * viewHeight);
    this.scrollbarThumb.height = thumbHeight;
    
    // Hide scrollbar if not needed
    const needsScroll = this.contentHeight > viewHeight;
    this.scrollbarThumb.setVisible(needsScroll);
    this.scrollbarTrack.setVisible(needsScroll);
    
    this.updateThumbPosition();
  }
  
  // Update thumb position based on scroll
  updateThumbPosition() {
    if (this.maxScrollY <= 0) return;
    
    const viewHeight = this.height - this.padding * 2;
    const scrollRatio = this.scrollY / this.maxScrollY;
    const thumbTravel = viewHeight - this.scrollbarThumb.height;
    this.scrollbarThumb.y = this.padding + scrollRatio * thumbTravel;
  }
  
  // Update content position based on scroll
  updateContentPosition() {
    this.contentContainer.y = this.padding - this.scrollY;
    this.updateThumbPosition();
  }
  
  // Clamp scroll to valid range
  clampScroll() {
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScrollY);
  }
  
  // Scroll to top
  scrollToTop() {
    this.scrollY = 0;
    this.updateContentPosition();
  }
  
  // Scroll to bottom
  scrollToBottom() {
    this.scrollY = this.maxScrollY;
    this.updateContentPosition();
  }
  
  // Show/hide the panel
  setVisible(visible) {
    this.container.setVisible(visible);
    return this;
  }
  
  // Get visibility
  get visible() {
    return this.container.visible;
  }
  
  // Set position
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.container.setPosition(x, y);
    
    // Update mask position
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
      x + this.padding,
      y + this.padding,
      this.width - this.padding * 2 - this.scrollbarWidth - 4,
      this.height - this.padding * 2
    );
    this.mask = maskShape.createGeometryMask();
    this.contentContainer.setMask(this.mask);
    
    return this;
  }
  
  // Set depth
  setDepth(depth) {
    this.container.setDepth(depth);
    return this;
  }
  
  // Destroy the panel
  destroy() {
    this.container.destroy();
  }
}
