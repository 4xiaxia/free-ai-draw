import { Translations } from '../types';

const enTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'Hand — H',
  'toolbar.selection': 'Selection — V',
  'toolbar.mind': 'Mind — M',
  'toolbar.text': 'Text — T',
  'toolbar.arrow': 'Arrow — A',
  'toolbar.shape': 'Shape',
  'toolbar.image': 'Image — Cmd+U',
  'toolbar.iconLibrary': 'Asset Library',
  'toolbar.extraTools': 'Extra Tools',

  'toolbar.pen': 'Pen — P',
  'toolbar.eraser': 'Eraser — E',

  'toolbar.arrow.straight': 'Straight Arrow Line',
  'toolbar.arrow.elbow': 'Elbow Arrow Line',
  'toolbar.arrow.curve': 'Curve Arrow Line',

  'toolbar.shape.rectangle': 'Rectangle — R',
  'toolbar.shape.ellipse': 'Ellipse — O',
  'toolbar.shape.triangle': 'Triangle',
  'toolbar.shape.terminal': 'Terminal',
  'toolbar.shape.noteCurlyLeft': 'Curly Note — Left',
  'toolbar.shape.noteCurlyRight': 'Curly Note — Right',
  'toolbar.shape.diamond': 'Diamond',
  'toolbar.shape.parallelogram': 'Parallelogram',
  'toolbar.shape.roundRectangle': 'Round Rectangle',

  // Zoom controls
  'zoom.in': 'Zoom In — Cmd++',
  'zoom.out': 'Zoom Out — Cmd+-',
  'zoom.fit': 'Fit to Screen',
  'zoom.100': 'Zoom to 100%',

  // Themes
  'theme.default': 'Default',
  'theme.colorful': 'Colorful',
  'theme.soft': 'Soft',
  'theme.retro': 'Retro',
  'theme.dark': 'Dark',
  'theme.starry': 'Starry',

  // Colors
  'color.none': 'Topic Color',
  'color.unknown': 'Other Color',
  'color.default': 'Basic Black',
  'color.white': 'White',
  'color.gray': 'Grey',
  'color.deepBlue': 'Deep Blue',
  'color.red': 'Red',
  'color.green': 'Green',
  'color.yellow': 'Yellow',
  'color.purple': 'Purple',
  'color.orange': 'Orange',
  'color.pastelPink': 'Paster Pink',
  'color.cyan': 'Cyan',
  'color.brown': 'Brown',
  'color.forestGreen': 'Forest Green',
  'color.lightGray': 'Light Grey',

  // General
  'general.undo': 'Undo',
  'general.redo': 'Redo',
  'general.menu': 'App Menu',
  'general.moreOptions': 'More Options',
  'general.duplicate': 'Duplicate',
  'general.delete': 'Delete',
  'general.layerOrder': 'Layer Order',
  'general.bringForward': 'Bring Forward',
  'general.sendBackward': 'Send Backward',
  'general.bringToFront': 'Bring to Front',
  'general.sendToBack': 'Send to Back',
  'general.arrange': 'Arrange',
  'general.alignToCanvas': 'Align to Canvas',
  'general.alignToSelection': 'Align to Selection',
  'general.alignLeft': 'Align Left',
  'general.alignCenter': 'Align Center',
  'general.alignRight': 'Align Right',
  'general.alignTop': 'Align Top',
  'general.alignMiddle': 'Align Middle',
  'general.alignBottom': 'Align Bottom',
  'general.distribute': 'Distribute',
  'general.distributeHorizontally': 'Distribute Horizontally',
  'general.distributeVertically': 'Distribute Vertically',

  // Language
  'language.switcher': 'Language',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',
  // Menu items
  'menu.open': 'Open',
  'menu.saveFile': 'Save File',
  'menu.exportImage': 'Export Image',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.exportPptx': 'Export PPTX',
  'menu.cleanBoard': 'Clear Board',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid to Drawnix',
  'dialog.mermaid.description': 'Currently supports',
  'dialog.mermaid.flowchart': 'flowcharts',
  'dialog.mermaid.sequence': 'sequence diagrams',
  'dialog.mermaid.class': 'class diagrams',
  'dialog.mermaid.otherTypes':
    ', and other diagram types (rendered as images).',
  'dialog.mermaid.syntax': 'Mermaid Syntax',
  'dialog.mermaid.placeholder': 'Write your Mermaid chart definition here…',
  'dialog.mermaid.preview': 'Preview',
  'dialog.mermaid.insert': 'Insert',
  'dialog.markdown.description':
    'Supports automatic conversion of Markdown syntax to mind map.',
  'dialog.markdown.syntax': 'Markdown Syntax',
  'dialog.markdown.placeholder': 'Write your Markdown text definition here...',
  'dialog.markdown.preview': 'Preview',
  'dialog.markdown.insert': 'Insert',
  'dialog.svg.description':
    'Upload a ZIP asset package that contains the main SVG and a `components/` directory. Drawnix will prefer `_nobg` component images and rebuild texts, arrows, and components using the main SVG coordinate system.',
  'dialog.svg.syntax': 'ZIP Package Info',
  'dialog.svg.placeholder':
    'After selecting a ZIP package, the main SVG name and component count will appear here…',
  'dialog.svg.preview': 'Import Preview',
  'dialog.svg.insert': 'Insert',
  'dialog.svg.upload': 'Upload ZIP Package',
  'dialog.svg.error.invalidSvg': 'Invalid SVG content',
  'dialog.svg.summary.texts': 'Texts',
  'dialog.svg.summary.arrows': 'Connector arrows',
  'dialog.svg.summary.components': 'Components',
  'dialog.svg.summary.backgrounds': 'Ignored backgrounds',
  'dialog.autodraw.basicInfo': 'Basic Info',
  'dialog.autodraw.resources': 'Resources',
  'dialog.autodraw.chooseFile': 'Choose File',
  'dialog.autodraw.advancedSettings': 'Advanced Settings',
  'dialog.autodraw.noJob': 'No Job',
  'dialog.autodraw.filterLogs': 'Filter logs...',
  'dialog.autodraw.autoScroll': 'Auto-scroll',
  'dialog.autodraw.clearLogs': 'Clear Logs',
  'dialog.autodraw.description':
    'Generate from method text or upload an existing figure to continue from later stages. Autodraw will stream logs and import the final bundle into the canvas.',
  'dialog.autodraw.backendUrl': 'Backend URL',
  'dialog.autodraw.inputMode': 'Input Mode',
  'dialog.autodraw.modeGenerate': 'Generate Figure',
  'dialog.autodraw.modeSourceFigure': 'Upload Source Figure',
  'dialog.autodraw.modeGenerateHint':
    'Start from method text, generate a new figure first, then continue through SAM3 and SVG rebuild.',
  'dialog.autodraw.modeSourceHint':
    'Upload an existing figure, then choose whether to continue with full parsing or jump straight into SVG rebuild.',
  'dialog.autodraw.methodText': 'Method Text',
  'dialog.autodraw.placeholder': 'Describe the method you want to visualize...',
  'dialog.autodraw.referenceImage': 'Reference Style Image',
  'dialog.autodraw.sourceFigure': 'Source Figure',
  'dialog.autodraw.sourceFigureHint':
    'Supported: png, jpg, jpeg, webp. The upload is normalized into this job\'s `figure.png` and then follows the route you choose below.',
  'dialog.autodraw.sourceRunMode': 'Upload Route',
  'dialog.autodraw.sourceRunSegmented': 'Full Parsing',
  'dialog.autodraw.sourceRunDirectSvg': 'Direct SVG Rebuild',
  'dialog.autodraw.sourceRunSegmentedHint':
    'Continue through SAM3 segmentation, asset extraction, and background removal for figures that need decomposed components.',
  'dialog.autodraw.sourceRunDirectSvgHint':
    'Skip segmentation and icon cleanup. The multimodal model rebuilds `final.svg` directly and imports it into the canvas.',
  'dialog.autodraw.backgroundRemoval': 'Icon Background',
  'dialog.autodraw.backgroundRemovalOn': 'Remove Background',
  'dialog.autodraw.backgroundRemovalOff': 'Keep Background',
  'dialog.autodraw.backgroundRemovalHint':
    'Stage 3 crops each icon and removes its background for transparent component assets.',
  'dialog.autodraw.backgroundRemovalHintSkip':
    'Stage 3 only crops icons and skips background removal, so SVG rebuild reuses the original cutouts.',
  'dialog.autodraw.backgroundRemovalHintDirectSvg':
    'This route skips stage 3 entirely, so this control is ignored.',
  'dialog.autodraw.uploadZip': 'Import Local ZIP',
  'dialog.autodraw.bundleHint':
    'Upload a local bundle.zip to render it directly into the canvas without creating a backend job.',
  'dialog.autodraw.existingJobId': 'Existing Job ID',
  'dialog.autodraw.existingJobPlaceholder':
    'Enter any job_id and load its flow',
  'dialog.autodraw.loadJob': 'Load Job',
  'dialog.autodraw.provider': 'Provider',
  'dialog.autodraw.apiKey': 'API Key',
  'dialog.autodraw.baseUrl': 'Base URL',
  'dialog.autodraw.imageModel': 'Image Model',
  'dialog.autodraw.imageSize': 'Image Size',
  'dialog.autodraw.imageSizeHint':
    'Only applies when generating a new figure. Uploaded source figures skip stage 1, so this control is ignored.',
  'dialog.autodraw.samPrompt': 'SAM3 Prompt',
  'dialog.autodraw.samPromptHint':
    'Use comma-separated prompts such as `icon,diagram,arrow`.',
  'dialog.autodraw.samPromptHintDirectSvg':
    'Direct SVG rebuild skips SAM3 segmentation, so this field is ignored.',
  'dialog.autodraw.svgModel': 'SVG Model',
  'dialog.autodraw.generate': 'Generate',
  'dialog.autodraw.cancel': 'Terminate',
  'dialog.autodraw.cancelling': 'Terminating',
  'dialog.autodraw.resume': 'Resume',
  'dialog.autodraw.copyJobId': 'Copy ID',
  'dialog.autodraw.copied': 'Copied',
  'dialog.autodraw.viewFlow': 'View Flow',
  'dialog.autodraw.downloadBundle': 'Download ZIP',
  'dialog.autodraw.rebuildJob': 'Rebuild',
  'dialog.autodraw.replayFromStage': 'Replay From Stage',
  'dialog.autodraw.replayFromHere': 'Replay From Here',
  'dialog.autodraw.replayStageLabel': 'Replay stage',
  'dialog.autodraw.openAssetActions': 'Open Asset Actions',
  'dialog.autodraw.assetActions': 'Asset Actions',
  'dialog.autodraw.hideWorkbench': 'Minimize',
  'dialog.autodraw.referenceGallery': 'Reference Gallery',
  'dialog.autodraw.galleryChooseFolder': 'Choose Gallery Folder',
  'dialog.autodraw.galleryRefresh': 'Refresh Gallery',
  'dialog.autodraw.galleryDisconnect': 'Disconnect Gallery',
  'dialog.autodraw.galleryDirectoryReady': 'Gallery Connected',
  'dialog.autodraw.galleryHint':
    'Choose a local folder as the style gallery. Each file name becomes the visible style name.',
  'dialog.autodraw.galleryLive': 'Persistent Gallery',
  'dialog.autodraw.galleryEmpty':
    'No usable images in the gallery yet. Supported: png, jpg, jpeg, webp.',
  'dialog.autodraw.galleryLoading': 'Loading gallery...',
  'dialog.autodraw.galleryUnsupported':
    'This browser cannot read a local gallery folder. Use Chromium or the temporary upload below.',
  'dialog.autodraw.galleryPermissionHint':
    'Gallery permission is missing. Reconnect or refresh the selected folder.',
  'dialog.autodraw.galleryLoadFailed': 'Failed to load gallery',
  'dialog.autodraw.galleryMissingSelection':
    'The previously selected reference is no longer in the gallery.',
  'dialog.autodraw.manualReference': 'Temporary Upload',
  'dialog.autodraw.manualReferenceHint':
    'Temporary uploads only last for the current session. Put reusable references into the gallery above.',
  'dialog.autodraw.selectedStyle': 'Current Reference Style',
  'dialog.autodraw.assetRoom': 'Asset Room',
  'dialog.autodraw.assetHint':
    'Generated figures, icons, and SVGs appear here as they are produced. Click any visual asset to enlarge it.',
  'dialog.autodraw.assetHintLive':
    'Only component `_nobg` icon assets are shown here, and the shelf updates live with pipeline progress.',
  'dialog.autodraw.noAssets':
    'Assets will appear here once the pipeline starts producing them.',
  'dialog.autodraw.openPreview': 'Open Preview',
  'dialog.autodraw.timeline': 'Timeline',
  'dialog.autodraw.rawLogs': 'Raw Logs',
  'dialog.autodraw.history': 'History',
  'dialog.autodraw.noHistory': 'No history yet',
  'dialog.autodraw.clearHistory': 'Clear History',
  'dialog.autodraw.deleteHistoryEntry': 'Delete entry',
  'dialog.autodraw.deleteHistoryPrompt': 'Delete this history entry?',
  'dialog.autodraw.deleteHistoryHint':
    'This only removes the local history item and will not delete the job or board content.',
  'dialog.autodraw.importMonitor': 'Import Monitor',
  'dialog.autodraw.returnWorkbench': 'Expand Workbench',
  'dialog.autodraw.importWatchingHint':
    'The workbench docks itself while importing so you can watch the actual assembly on the canvas.',
  'dialog.autodraw.historyJob': 'Generated Job',
  'dialog.autodraw.historyLocal': 'Local ZIP',
  'dialog.autodraw.statusLabel': 'Status',
  'dialog.autodraw.jobId': 'Job ID',
  'dialog.autodraw.failedStage': 'Failed Stage',
  'dialog.autodraw.logMode': 'Log Mode',
  'dialog.autodraw.emptyLogs': 'No logs yet',
  'dialog.autodraw.summary.texts': 'Texts',
  'dialog.autodraw.summary.arrows': 'Arrows',
  'dialog.autodraw.summary.components': 'Components',
  'dialog.autodraw.workbench': 'Pipeline Workbench',
  'dialog.autodraw.activity': 'Live Activity',
  'dialog.autodraw.latestImport': 'Canvas Assembly',
  'dialog.autodraw.readyHint':
    'Describe the method and add a reference image to watch the pipeline assemble here step by step.',
  'dialog.autodraw.runningStageHint':
    'The board favors assets from the active stage. If that stage has no visual file yet, only progress stays visible here.',
  'dialog.autodraw.referenceHint':
    'Use a paper figure with a close visual rhythm to stabilize typography and layout.',
  'dialog.autodraw.stage.generateFigure': 'Generate Figure',
  'dialog.autodraw.stage.parseStructure': 'Parse Structure',
  'dialog.autodraw.stage.extractAssets': 'Extract Assets',
  'dialog.autodraw.stage.rebuildSvg': 'Rebuild SVG',
  'dialog.autodraw.stage.importCanvas': 'Import to Canvas',
  'dialog.autodraw.status.idle': 'Ready',
  'dialog.autodraw.status.queued': 'Queued',
  'dialog.autodraw.status.running': 'Running',
  'dialog.autodraw.status.cancelling': 'Terminating',
  'dialog.autodraw.status.submitting': 'Submitting',
  'dialog.autodraw.status.importing': 'Importing',
  'dialog.autodraw.status.succeeded': 'Succeeded',
  'dialog.autodraw.status.cancelled': 'Terminated',
  'dialog.autodraw.status.failed': 'Failed',
  'dialog.autodraw.error.noMethodText': 'Please enter method text first',
  'dialog.autodraw.error.noSourceFigure':
    'Please upload a source figure first',
  'dialog.autodraw.error.submitFailed': 'Failed to submit job',
  'dialog.autodraw.error.cancelFailed': 'Failed to terminate job',
  'dialog.autodraw.error.jobFailed': 'Job failed',
  'dialog.autodraw.error.noBundle': 'Job succeeded but no bundle was returned',
  'dialog.autodraw.error.logFailed': 'Failed to fetch logs',
  'dialog.error.loadMermaid': 'Failed to load Mermaid library',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid to Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown to Drawnix',
  'extraTools.autodraw': 'Autodraw',

  // Clean confirm dialog
  'cleanConfirm.title': 'Clear Board',
  'cleanConfirm.description':
    'This will clear the entire board. Do you want to continue?',
  'cleanConfirm.cancel': 'Cancel',
  'cleanConfirm.ok': 'OK',

  // Link popup items
  'popupLink.delLink': 'Delete Link',

  // Tool popup items
  'popupToolbar.fillColor': 'Fill Color',
  'popupToolbar.fontFamily': 'Font',
  'popupToolbar.fontSize': 'Font Size',
  'popupToolbar.fontColor': 'Font Color',
  'popupToolbar.link': 'Insert Link',
  'popupToolbar.cornerRadius': 'Corner Radius',
  'popupToolbar.stroke': 'Stroke',
  'popupToolbar.opacity': 'Opacity',
  'popupToolbar.aiEditImage': 'AI Edit',
  'popupToolbar.replaceImage': 'Replace Image',

  // Icon library
  'iconLibrary.upload': 'Upload Assets',
  'iconLibrary.uploading': 'Uploading...',
  'iconLibrary.empty': 'Upload SVG, PNG, JPG, or WebP assets to build your library.',
  'iconLibrary.hint':
    'Double-click an asset to insert it onto the board. If a node is selected, it will be replaced directly.',
  'iconLibrary.remove': 'Remove asset',
  'assetLibrary.search': 'Search assets...',
  'assetLibrary.filter': 'Filter assets',
  'assetLibrary.filter.all': 'All',
  'assetLibrary.filter.image': 'Images',
  'assetLibrary.filter.svg': 'SVG',
  'assetLibrary.filter.favorite': 'Favorites',
  'assetLibrary.sort': 'Sort',
  'assetLibrary.sort.recent': 'Recent',
  'assetLibrary.sort.name': 'Name',
  'assetLibrary.sort.size': 'Size',
  'assetLibrary.sort.type': 'Type',
  'assetLibrary.count': '{count} assets',
  'assetLibrary.dropHint': 'Drop files here to upload',
  'assetLibrary.emptyAction': 'Upload assets',
  'assetLibrary.noResults': 'No matching assets',
  'assetLibrary.unsupported': 'Upload SVG, PNG, JPG, or WebP assets.',
  'assetLibrary.uploadFailed': 'Upload failed. Check file type and size.',
  'assetLibrary.type': 'Type',
  'assetLibrary.source': 'Source',
  'assetLibrary.source.local': 'Local upload',
  'assetLibrary.source.ai': 'AI',
  'assetLibrary.source.built-in': 'Built-in',
  'assetLibrary.createdAt': 'Created',
  'assetLibrary.size': 'File size',
  'assetLibrary.insert': 'Insert',
  'assetLibrary.setSubject': 'Set as subject',
  'assetLibrary.subjectSet': 'Subject set',
  'assetLibrary.favorite': 'Favorite',
  'assetLibrary.unfavorite': 'Unfavorite',
  'assetLibrary.download': 'Download',
  'assetLibrary.rename': 'Rename asset',
  'assetLibrary.selectAsset': 'Select an asset to view details',
  'assetLibrary.usage': 'Used {used} / {limit}',

  // Text placeholders
  'textPlaceholders.link': 'Link',
  'textPlaceholders.text': 'Text',

  // Line tool
  'line.source': 'Start',
  'line.target': 'End',
  'line.arrow': 'Arrow',
  'line.none': 'None',
  'line.enableAnimation': 'Enable animation',
  'line.disableAnimation': 'Disable animation',

  // Stroke style
  'stroke.solid': 'Solid',
  'stroke.dashed': 'Dashed',
  'stroke.dotted': 'Dotted',

  //markdown example
  'markdown.example': `# I have started

  - Let me see who made this bug 🕵️ ♂️ 🔍
    - 😯 💣
      - Turns out it was me 👈 🎯 💘

  - Unexpectedly, it cannot run; why is that 🚫 ⚙️ ❓
    - Unexpectedly, it can run now; why is that? 🎢 ✨
      - 🤯 ⚡ ➡️ 🎉

  - What can run 🐞 🚀
    - then do not touch it 🛑 ✋
      - 👾 💥 🏹 🎯

  ## Boy or girl 👶 ❓ 🤷 ♂️ ♀️

  ### Hello world 👋 🌍 ✨ 💻

  #### Wow, a programmer 🤯 ⌨️ 💡 👩 💻`,

  // Draw elements text
  'draw.lineText': 'Text',
  'draw.geometryText': 'Text',

  // Mind map elements text
  'mind.centralText': 'Central Topic',
  'mind.abstractNodeText': 'Summary',

  'toolbar.llmMermaid': 'auto-mermaid',
  'dialog.llmMermaid.title': 'AI Pipeline Assistant',
  'dialog.llmMermaid.chat': 'Chat',
  'dialog.llmMermaid.preview': 'Preview',
  'dialog.llmMermaid.placeholder':
    'Describe the flowchart you want to generate...',
  'dialog.llmMermaid.insert': 'Insert',
  'dialog.llmMermaid.close': 'Close',

  'dialog.imageEdit.title': 'Edit Current Image',
  'dialog.imageEdit.description':
    'Submit an AI image-edit job from the currently selected image and replace it in place when it succeeds.',
  'dialog.imageEdit.prompt': 'Edit Prompt',
  'dialog.imageEdit.promptPlaceholder':
    'For example: turn the background into a clean tech illustration and sharpen the subject edges',
  'dialog.imageEdit.sourceImage': 'Current Image',
  'dialog.imageEdit.backendUrl': 'Backend URL',
  'dialog.imageEdit.provider': 'Provider',
  'dialog.imageEdit.apiKey': 'API Key',
  'dialog.imageEdit.baseUrl': 'Base URL',
  'dialog.imageEdit.imageModel': 'Image Model',
  'dialog.imageEdit.removeBackground': 'Remove background before replacing',
  'dialog.imageEdit.removeBackgroundHint':
    'Best for white or noisy backgrounds. When enabled, the generated image is cut out once more before replacement.',
  'dialog.imageEdit.generate': 'Start Editing',
  'dialog.imageEdit.close': 'Close',
  'dialog.imageEdit.targetMissing':
    'No editable image target was found. Please reselect the image and try again.',
  'dialog.imageEdit.overlayLabel': 'Editing',
  'dialog.imageEdit.status.idle': 'Ready',
  'dialog.imageEdit.status.submitting': 'Submitting',
  'dialog.imageEdit.status.running': 'Running',
  'dialog.imageEdit.status.succeeded': 'Succeeded',
  'dialog.imageEdit.status.failed': 'Failed',
  'dialog.imageEdit.error.noPrompt': 'Please enter an image edit prompt first',
  'dialog.imageEdit.error.noTarget': 'There is no editable target image right now',
  'dialog.imageEdit.error.exportFailed':
    'The current image could not be read. Please re-import it and try again.',
  'dialog.imageEdit.error.submitFailed': 'Failed to submit the image edit job',
  'dialog.imageEdit.error.jobFailed': 'The image edit job failed',
  'dialog.imageEdit.error.noResult':
    'The job finished, but no edited image result was returned',

  'dialog.close': 'Close',

  'tutorial.title': 'Drawnix',
  'tutorial.description':
    'All-in-one whiteboard, including mind maps, flowcharts, free drawing, and more',
  'tutorial.dataDescription': 'All data is stored locally in your browser',
  'tutorial.appToolbar': 'Export, language settings, ...',
  'tutorial.creationToolbar': 'Select a tool to start your creation',
  'tutorial.themeDescription': 'Switch between light and dark themes',
};

export default enTranslations;
