import { Translations } from '../types';

const arTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'اليد — H',
  'toolbar.selection': 'التحديد — V',
  'toolbar.mind': 'خريطة ذهنية — M',
  'toolbar.eraser': 'ممحاة — E',
  'toolbar.text': 'نص — T',
  'toolbar.pen': 'قلم — P',
  'toolbar.arrow': 'سهم — A',
  'toolbar.shape': 'أشكال',
  'toolbar.image': 'صورة — Cmd+U',
  'toolbar.iconLibrary': 'مكتبة المواد',
  'toolbar.extraTools': 'أدوات إضافية',

  'toolbar.arrow.straight': 'سهم مستقيم',
  'toolbar.arrow.elbow': 'سهم بزوايا',
  'toolbar.arrow.curve': 'سهم منحني',

  'toolbar.shape.rectangle': 'مستطيل — R',
  'toolbar.shape.ellipse': 'بيضاوي — O',
  'toolbar.shape.triangle': 'مثلث',
  'toolbar.shape.terminal': 'نهائي',
  'toolbar.shape.noteCurlyLeft': 'ملاحظة معقوفة — يسار',
  'toolbar.shape.noteCurlyRight': 'ملاحظة معقوفة — يمين',
  'toolbar.shape.diamond': 'معين',
  'toolbar.shape.parallelogram': 'متوازي أضلاع',
  'toolbar.shape.roundRectangle': 'مستطيل دائري الحواف',

  // Zoom controls
  'zoom.in': 'تكبير — Cmd++',
  'zoom.out': 'تصغير — Cmd+-',
  'zoom.fit': 'ملاءمة الشاشة',
  'zoom.100': 'تكبير إلى 100%',

  // Themes
  'theme.default': 'افتراضي',
  'theme.colorful': 'ملون',
  'theme.soft': 'ناعم',
  'theme.retro': 'كلاسيكي',
  'theme.dark': 'داكن',
  'theme.starry': 'ليلي',

  // Colors
  'color.none': 'لون الموضوع',
  'color.unknown': 'لون آخر',
  'color.default': 'أسود أساسي',
  'color.white': 'أبيض',
  'color.gray': 'رمادي',
  'color.deepBlue': 'أزرق غامق',
  'color.red': 'أحمر',
  'color.green': 'أخضر',
  'color.yellow': 'أصفر',
  'color.purple': 'بنفسجي',
  'color.orange': 'برتقالي',
  'color.pastelPink': 'وردي فاتح',
  'color.cyan': 'سماوي',
  'color.brown': 'بني',
  'color.forestGreen': 'أخضر غامق (غابة)',
  'color.lightGray': 'رمادي فاتح',

  // General
  'general.undo': 'تراجع',
  'general.redo': 'إعادة',
  'general.menu': 'قائمة التطبيق',
  'general.moreOptions': 'خيارات إضافية',
  'general.duplicate': 'تكرار',
  'general.delete': 'حذف',
  'general.layerOrder': 'الطبقات',
  'general.bringForward': 'تقديم خطوة',
  'general.sendBackward': 'إرسال للخلف خطوة',
  'general.bringToFront': 'إحضار إلى الأمام',
  'general.sendToBack': 'إرسال إلى الخلف',
  'general.arrange': 'ترتيب',
  'general.alignToCanvas': 'محاذاة إلى اللوحة',
  'general.alignToSelection': 'محاذاة إلى التحديد',
  'general.alignLeft': 'محاذاة لليسار',
  'general.alignCenter': 'توسيط أفقي',
  'general.alignRight': 'محاذاة لليمين',
  'general.alignTop': 'محاذاة للأعلى',
  'general.alignMiddle': 'توسيط عمودي',
  'general.alignBottom': 'محاذاة للأسفل',
  'general.distribute': 'توزيع متساو',
  'general.distributeHorizontally': 'توزيع أفقي',
  'general.distributeVertically': 'توزيع عمودي',

  // Language
  'language.switcher': 'اللغة',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',

  // Menu items
  'menu.open': 'فتح',
  'menu.saveFile': 'حفظ الملف',
  'menu.exportImage': 'تصدير صورة',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.exportPptx': 'تصدير PPTX',
  'menu.cleanBoard': 'مسح اللوحة',
  'menu.github': 'غيت هب',

  // Dialog translations
  'dialog.mermaid.title': 'من Mermaid إلى Drawnix',
  'dialog.mermaid.description': 'يدعم حاليًا',
  'dialog.mermaid.flowchart': 'المخططات الانسيابية',
  'dialog.mermaid.sequence': 'مخططات التسلسل',
  'dialog.mermaid.class': 'مخططات الفئات',
  'dialog.mermaid.otherTypes': '، وأنواع أخرى من المخططات (تُعرض كصور).',
  'dialog.mermaid.syntax': 'صيغة Mermaid',
  'dialog.mermaid.placeholder': 'اكتب تعريف المخطط هنا...',
  'dialog.mermaid.preview': 'معاينة',
  'dialog.mermaid.insert': 'إدراج',
  'dialog.markdown.description':
    'يدعم التحويل التلقائي من Markdown إلى خريطة ذهنية.',
  'dialog.markdown.syntax': 'صيغة Markdown',
  'dialog.markdown.placeholder': 'اكتب نص Markdown هنا...',
  'dialog.markdown.preview': 'معاينة',
  'dialog.markdown.insert': 'إدراج',
  'dialog.svg.description':
    'ارفع حزمة ZIP تحتوي على ملف SVG الرئيسي ومجلد `components/`. سيعطي Drawnix أولوية لصور `_nobg` ويعيد بناء النصوص والأسهم والمكونات وفق إحداثيات SVG الرئيسي.',
  'dialog.svg.syntax': 'معلومات حزمة ZIP',
  'dialog.svg.placeholder':
    'بعد اختيار حزمة ZIP سيظهر هنا اسم ملف SVG الرئيسي وعدد المكونات…',
  'dialog.svg.preview': 'معاينة الاستيراد',
  'dialog.svg.insert': 'إدراج',
  'dialog.svg.upload': 'رفع حزمة ZIP',
  'dialog.svg.error.invalidSvg': 'محتوى SVG غير صالح',
  'dialog.svg.summary.texts': 'النصوص',
  'dialog.svg.summary.arrows': 'أسهم الربط',
  'dialog.svg.summary.components': 'المكونات',
  'dialog.svg.summary.backgrounds': 'الخلفيات المتجاهلة',
  'dialog.autodraw.description':
    'Generate from method text or upload an existing figure to continue from later stages. Autodraw will stream logs and import the final bundle into the canvas.',
  'dialog.autodraw.basicInfo': 'Basic Info',
  'dialog.autodraw.resources': 'Resources',
  'dialog.autodraw.chooseFile': 'Choose File',
  'dialog.autodraw.advancedSettings': 'Advanced Settings',
  'dialog.autodraw.noJob': 'No Job',
  'dialog.autodraw.filterLogs': 'Filter logs...',
  'dialog.autodraw.autoScroll': 'Auto-scroll',
  'dialog.autodraw.clearLogs': 'Clear Logs',
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
    'Only previewable visual assets are shown here, and the shelf updates live with pipeline progress.',
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
  'dialog.error.loadMermaid': 'فشل في تحميل مكتبة Mermaid',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'من Mermaid إلى Drawnix',
  'extraTools.markdownToDrawnix': 'من Markdown إلى Drawnix',
  'extraTools.autodraw': 'Autodraw',

  // Clean confirm dialog
  'cleanConfirm.title': 'مسح اللوحة',
  'cleanConfirm.description':
    'سيؤدي هذا إلى مسح اللوحة بالكامل. هل تريد المتابعة؟',
  'cleanConfirm.cancel': 'إلغاء',
  'cleanConfirm.ok': 'موافق',

  // Link popup items
  'popupLink.delLink': 'حذف الرابط',

  // Tool popup items
  'popupToolbar.fillColor': 'لون التعبئة',
  'popupToolbar.fontFamily': 'الخط',
  'popupToolbar.fontSize': 'حجم الخط',
  'popupToolbar.fontColor': 'لون الخط',
  'popupToolbar.link': 'إدراج رابط',
  'popupToolbar.cornerRadius': 'نصف قطر الزاوية',
  'popupToolbar.stroke': 'الحد',
  'popupToolbar.opacity': 'مستوى شفافية',
  'popupToolbar.aiEditImage': 'AI Edit',
  'popupToolbar.replaceImage': 'Replace Image',

  // Icon library
  'iconLibrary.upload': 'رفع الأيقونات',
  'iconLibrary.uploading': 'جارٍ الرفع...',
  'iconLibrary.empty':
    'ارفع ملفات SVG أو PNG أو JPG لبدء بناء مكتبة الأيقونات.',
  'iconLibrary.hint':
    'انقر على الأيقونة لإضافتها إلى اللوحة. إذا كانت هناك عقدة محددة فسيتم استبدالها مباشرة.',
  'iconLibrary.remove': 'حذف الأيقونة',
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
  'textPlaceholders.link': 'رابط',
  'textPlaceholders.text': 'نص',

  // Line tool
  'line.source': 'بداية',
  'line.target': 'نهاية',
  'line.arrow': 'سهم',
  'line.none': 'لا شيء',
  'line.enableAnimation': 'تشغيل الحركة',
  'line.disableAnimation': 'إيقاف الحركة',

  // Stroke style
  'stroke.solid': 'صلب',
  'stroke.dashed': 'متقطع',
  'stroke.dotted': 'منقط',

  //markdown example
  //   "markdown.example": "# لقد بدأت\n\n- دعني أرى من تسبب بهذا الخطأ 🕵️ ♂️ 🔍\n  - 😯 💣\n    - اتضح أنه أنا 👈 🎯 💘\n\n- بشكل غير متوقع، لا يعمل؛ لماذا 🚫 ⚙️ ❓\n  - بشكل غير متوقع، أصبح يعمل الآن؛ لماذا؟ 🎢 ✨\n    - 🤯 ⚡ ➡️ 🎉\n\n- ما الذي يمكن تشغيله 🐞 🚀\n  - إذًا لا تلمسه 🛑 ✋\n    - 👾 💥 🏹 🎯\n\n## ولد أم بنت 👶 ❓ 🤷 ♂️ ♀️\n\n### مرحبًا بالعالم 👋 🌍 ✨ 💻\n\n#### واو، مبرمج 🤯 ⌨️ 💡 👩 💻",
  'markdown.example': `# I have started

  - دعني أرى من تسبب بهذا الخطأ  🕵️ ♂️ 🔍
    - 😯 💣
      - اتضح أنه أنا 👈 🎯 💘

  - بشكل غير متوقع، لا يعمل؛ لماذا  🚫 ⚙️ ❓
    - بشكل غير متوقع، أصبح يعمل الآن؛ لماذا؟ 🎢 ✨
      - 🤯 ⚡ ➡️ 🎉

  - ما الذي يمكن تشغيله 🐞 🚀
    - إذًا لا تلمسه 🛑 ✋
      - 👾 💥 🏹 🎯

  ## ولد أم بنت  👶 ❓ 🤷 ♂️ ♀️

  ### Hello world 👋 🌍 ✨ 💻

  #### Wow, a programmer 🤯 ⌨️ 💡 👩 💻`,

  // Draw elements text
  'draw.lineText': 'نص',
  'draw.geometryText': 'نص',

  // Mind map elements text
  'mind.centralText': 'الموضوع المركزي',
  'mind.abstractNodeText': 'ملخص',

  'toolbar.llmMermaid': 'auto-mermaid',
  'dialog.llmMermaid.title': 'مساعد AI Pipeline',
  'dialog.llmMermaid.chat': 'محادثة AI',
  'dialog.llmMermaid.preview': 'معاينة',
  'dialog.llmMermaid.placeholder': 'صف المخطط الذي تريد إنشاءه...',
  'dialog.llmMermaid.insert': 'إدراج',
  'dialog.llmMermaid.close': 'إغلاق',
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
  'dialog.close': 'إغلاق',

  'tutorial.title': 'Drawnix',
  'tutorial.description':
    'سبورة شاملة تتضمن الخرائط الذهنية والمخططات الانسيابية والرسم الحر وغير ذلك',
  'tutorial.dataDescription': 'تُحفظ جميع البيانات محليًا في متصفحك',
  'tutorial.appToolbar': 'تصدير، إعدادات اللغة، ...',
  'tutorial.creationToolbar': 'اختر أداة لبدء الإنشاء',
  'tutorial.themeDescription': 'التبديل بين السمة الفاتحة والداكنة',
};

export default arTranslations;
