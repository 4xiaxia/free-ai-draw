import { Translations } from '../types';

const ruTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'Рука — H',
  'toolbar.selection': 'Выделение — V',
  'toolbar.mind': 'Mind-карта — M',
  'toolbar.text': 'Текст — T',
  'toolbar.arrow': 'Стрелка — A',
  'toolbar.shape': 'Фигуры',
  'toolbar.image': 'Изображение — Cmd+U',
  'toolbar.iconLibrary': 'Библиотека ассетов',
  'toolbar.extraTools': 'Дополнительно',

  'toolbar.pen': 'Карандаш — P',
  'toolbar.eraser': 'Ластик — E',

  'toolbar.arrow.straight': 'Прямая стрелка',
  'toolbar.arrow.elbow': 'Ломаная стрелка',
  'toolbar.arrow.curve': 'Кривая стрелка',

  'toolbar.shape.rectangle': 'Прямоугольник — R',
  'toolbar.shape.ellipse': 'Эллипс — O',
  'toolbar.shape.triangle': 'Треугольник',
  'toolbar.shape.terminal': 'Останов',
  'toolbar.shape.noteCurlyLeft': 'Фигурная заметка — слева',
  'toolbar.shape.noteCurlyRight': 'Фигурная заметка — справа',
  'toolbar.shape.diamond': 'Ромб',
  'toolbar.shape.parallelogram': 'Параллелограмм',
  'toolbar.shape.roundRectangle': 'Скруглённый прямоугольник',

  // Zoom controls
  'zoom.in': 'Увеличить — Cmd++',
  'zoom.out': 'Уменьшить — Cmd+-',
  'zoom.fit': 'По размеру экрана',
  'zoom.100': 'Сбросить к 100%',

  // Themes
  'theme.default': 'Стандартная',
  'theme.colorful': 'Красочная',
  'theme.soft': 'Мягкая',
  'theme.retro': 'Старинная',
  'theme.dark': 'Тёмная',
  'theme.starry': 'Звёздная',

  // Colors
  'color.none': 'Автоматически',
  'color.unknown': 'Другой цвет',
  'color.default': 'Чёрный',
  'color.white': 'Белый',
  'color.gray': 'Серый',
  'color.deepBlue': 'Голубой',
  'color.red': 'Красный',
  'color.green': 'Зелёный',
  'color.yellow': 'Жёлтый',
  'color.purple': 'Фиолетовый',
  'color.orange': 'Оранжевый',
  'color.pastelPink': 'Розовый',
  'color.cyan': 'Лиловый',
  'color.brown': 'Коричневый',
  'color.forestGreen': 'Сосновный',
  'color.lightGray': 'Светло-серый',

  // General
  'general.undo': 'Отменить',
  'general.redo': 'Вернуть',
  'general.menu': 'Меню приложения',
  'general.moreOptions': 'Дополнительно',
  'general.duplicate': 'Дублировать',
  'general.delete': 'Удалить',
  'general.layerOrder': 'Слой',
  'general.bringForward': 'Поднять на один уровень',
  'general.sendBackward': 'Опустить на один уровень',
  'general.bringToFront': 'На передний план',
  'general.sendToBack': 'На задний план',
  'general.arrange': 'Выравнивание',
  'general.alignToCanvas': 'По холсту',
  'general.alignToSelection': 'По выделению',
  'general.alignLeft': 'По левому краю',
  'general.alignCenter': 'По центру',
  'general.alignRight': 'По правому краю',
  'general.alignTop': 'По верхнему краю',
  'general.alignMiddle': 'По середине',
  'general.alignBottom': 'По нижнему краю',
  'general.distribute': 'Распределить',
  'general.distributeHorizontally': 'Распределить по горизонтали',
  'general.distributeVertically': 'Распределить по вертикали',

  // Language
  'language.switcher': 'Language',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',

  // Menu items
  'menu.open': 'Открыть',
  'menu.saveFile': 'Сохранить',
  'menu.exportImage': 'Экспортировать',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.exportPptx': 'Экспорт PPTX',
  'menu.cleanBoard': 'Очистить доску',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid в Drawnix',
  'dialog.mermaid.description': 'Поддерживаются',
  'dialog.mermaid.flowchart': 'блок-схемы',
  'dialog.mermaid.sequence': 'диаграммы последовательностей',
  'dialog.mermaid.class': 'диаграммы классов',
  'dialog.mermaid.otherTypes':
    ' и другие диаграммы (преобразуются в изображения).',
  'dialog.mermaid.syntax': 'Синтаксис Mermaid',
  'dialog.mermaid.placeholder':
    'Введите сюда описание вашей Mermaid-диаграммы…',
  'dialog.mermaid.preview': 'Предпросмотр',
  'dialog.mermaid.insert': 'Вставить',
  'dialog.markdown.description':
    'Поддерживается автоматическое преобразование синтаксиса Markdown в mind-карты.',
  'dialog.markdown.syntax': 'Синтаксис Markdown',
  'dialog.markdown.placeholder':
    'Введите сюда описание вашего текста Markdown…',
  'dialog.markdown.preview': 'Предпросмотр',
  'dialog.markdown.insert': 'Вставить',
  'dialog.svg.description':
    'Загрузите ZIP-пакет ресурсов с основным SVG и каталогом `components/`. Drawnix отдаст приоритет изображениям `_nobg` и восстановит текст, стрелки и компоненты по координатам основного SVG.',
  'dialog.svg.syntax': 'Информация о ZIP-пакете',
  'dialog.svg.placeholder':
    'После выбора ZIP-пакета здесь появятся имя SVG и количество компонентов…',
  'dialog.svg.preview': 'Предпросмотр импорта',
  'dialog.svg.insert': 'Вставить',
  'dialog.svg.upload': 'Загрузить ZIP-пакет',
  'dialog.svg.error.invalidSvg': 'Некорректное содержимое SVG',
  'dialog.svg.summary.texts': 'Тексты',
  'dialog.svg.summary.arrows': 'Соединительные стрелки',
  'dialog.svg.summary.components': 'Компоненты',
  'dialog.svg.summary.backgrounds': 'Пропущенные фоны',
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
  'dialog.error.loadMermaid': 'Не удалось загрузить библотеку Mermaid',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid в Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown в Drawnix',
  'extraTools.autodraw': 'Autodraw',

  // Clean confirm dialog
  'cleanConfirm.title': 'Очистить доску',
  'cleanConfirm.description':
    'Это удалит всё содержимое доски. Вы хотите продолжить?',
  'cleanConfirm.cancel': 'Отмена',
  'cleanConfirm.ok': 'ОК',

  // Link popup items
  'popupLink.delLink': 'Удалить ссылку',

  // Tool popup items
  'popupToolbar.fillColor': 'Цвет заливки',
  'popupToolbar.fontFamily': 'Шрифт',
  'popupToolbar.fontSize': 'Размер шрифта',
  'popupToolbar.fontColor': 'Цвет текста',
  'popupToolbar.link': 'Вставить ссылку',
  'popupToolbar.cornerRadius': 'Радиус скругления',
  'popupToolbar.stroke': 'Контур',
  'popupToolbar.opacity': 'Прозрачность',
  'popupToolbar.aiEditImage': 'AI Edit',
  'popupToolbar.replaceImage': 'Replace Image',

  // Icon library
  'iconLibrary.upload': 'Загрузить иконки',
  'iconLibrary.uploading': 'Загрузка...',
  'iconLibrary.empty':
    'Загрузите SVG, PNG или JPG, чтобы наполнить библиотеку иконок.',
  'iconLibrary.hint':
    'Нажмите на иконку, чтобы вставить ее на доску. Если узел уже выбран, он будет заменен напрямую.',
  'iconLibrary.remove': 'Удалить иконку',
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
  'textPlaceholders.link': 'Ссылка',
  'textPlaceholders.text': 'Текст',

  // Line tool
  'line.source': 'Начало',
  'line.target': 'Конец',
  'line.arrow': 'Стрелка',
  'line.none': 'Нет',
  'line.enableAnimation': 'Включить анимацию',
  'line.disableAnimation': 'Выключить анимацию',

  // Stroke style
  'stroke.solid': 'Сплошной',
  'stroke.dashed': 'Штриховой',
  'stroke.dotted': 'Пунктирный',

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
  'draw.lineText': 'Текст',
  'draw.geometryText': 'Текст',

  // Mind map elements text
  'mind.centralText': 'Центральная тема',
  'mind.abstractNodeText': 'Резюме',

  'toolbar.llmMermaid': 'auto-mermaid',
  'dialog.llmMermaid.title': 'AI Pipeline помощник',
  'dialog.llmMermaid.chat': 'AI чат',
  'dialog.llmMermaid.preview': 'Предпросмотр',
  'dialog.llmMermaid.placeholder': 'Опишите схему, которую хотите создать...',
  'dialog.llmMermaid.insert': 'Вставить',
  'dialog.llmMermaid.close': 'Закрыть',
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
  'dialog.close': 'Закрыть',

  'tutorial.title': 'Drawnix',
  'tutorial.description':
    'Универсальная доска: майнд-карты, блок-схемы, свободное рисование и многое другое',
  'tutorial.dataDescription': 'Все данные хранятся локально в вашем браузере',
  'tutorial.appToolbar': 'Экспорт, настройки языка, ...',
  'tutorial.creationToolbar': 'Выберите инструмент, чтобы начать творить',
  'tutorial.themeDescription': 'Переключение между светлой и тёмной темами',
};

export default ruTranslations;
