import { ReactNode } from 'react';

// Define supported languages
export type Language = 'zh' | 'en' | 'ru' | 'ar' | 'vi';

// Define translation keys and their corresponding values
export interface Translations {
  // Toolbar items
  'toolbar.hand': string;
  'toolbar.selection': string;
  'toolbar.mind': string;
  'toolbar.text': string;
  'toolbar.arrow': string;
  'toolbar.shape': string;
  'toolbar.image': string;
  'toolbar.iconLibrary': string;
  'toolbar.extraTools': string;

  'toolbar.pen': string;
  'toolbar.eraser': string;

  'toolbar.arrow.straight': string;
  'toolbar.arrow.elbow': string;
  'toolbar.arrow.curve': string;

  'toolbar.shape.rectangle': string;
  'toolbar.shape.ellipse': string;
  'toolbar.shape.triangle': string;
  'toolbar.shape.terminal': string;
  'toolbar.shape.noteCurlyLeft': string;
  'toolbar.shape.noteCurlyRight': string;
  'toolbar.shape.diamond': string;
  'toolbar.shape.parallelogram': string;
  'toolbar.shape.roundRectangle': string;

  // Zoom controls
  'zoom.in': string;
  'zoom.out': string;
  'zoom.fit': string;
  'zoom.100': string;

  // Themes
  'theme.default': string;
  'theme.colorful': string;
  'theme.soft': string;
  'theme.retro': string;
  'theme.dark': string;
  'theme.starry': string;

  // Colors
  'color.none': string;
  'color.unknown': string;
  'color.default': string;
  'color.white': string;
  'color.gray': string;
  'color.deepBlue': string;
  'color.red': string;
  'color.green': string;
  'color.yellow': string;
  'color.purple': string;
  'color.orange': string;
  'color.pastelPink': string;
  'color.cyan': string;
  'color.brown': string;
  'color.forestGreen': string;
  'color.lightGray': string;

  // General
  'general.undo': string;
  'general.redo': string;
  'general.menu': string;
  'general.moreOptions': string;
  'general.duplicate': string;
  'general.delete': string;
  'general.layerOrder': string;
  'general.bringForward': string;
  'general.sendBackward': string;
  'general.bringToFront': string;
  'general.sendToBack': string;
  'general.arrange': string;
  'general.alignToCanvas': string;
  'general.alignToSelection': string;
  'general.alignLeft': string;
  'general.alignCenter': string;
  'general.alignRight': string;
  'general.alignTop': string;
  'general.alignMiddle': string;
  'general.alignBottom': string;
  'general.distribute': string;
  'general.distributeHorizontally': string;
  'general.distributeVertically': string;

  // Language
  'language.switcher': string;
  'language.chinese': string;
  'language.english': string;
  'language.russian': string;
  'language.arabic': string;
  'language.vietnamese': string;

  // Menu items
  'menu.open': string;
  'menu.saveFile': string;
  'menu.exportImage': string;
  'menu.exportImage.svg': string;
  'menu.exportImage.png': string;
  'menu.exportImage.jpg': string;
  'menu.exportPptx': string;
  'menu.cleanBoard': string;
  'menu.github': string;

  // Dialog translations
  'dialog.mermaid.title': string;
  'dialog.mermaid.description': string;
  'dialog.mermaid.flowchart': string;
  'dialog.mermaid.sequence': string;
  'dialog.mermaid.class': string;
  'dialog.mermaid.otherTypes': string;
  'dialog.mermaid.syntax': string;
  'dialog.mermaid.placeholder': string;
  'dialog.mermaid.preview': string;
  'dialog.mermaid.insert': string;
  'dialog.markdown.description': string;
  'dialog.markdown.syntax': string;
  'dialog.markdown.placeholder': string;
  'dialog.markdown.preview': string;
  'dialog.markdown.insert': string;
  'dialog.svg.description': string;
  'dialog.svg.syntax': string;
  'dialog.svg.placeholder': string;
  'dialog.svg.preview': string;
  'dialog.svg.insert': string;
  'dialog.svg.upload': string;
  'dialog.svg.error.invalidSvg': string;
  'dialog.svg.summary.texts': string;
  'dialog.svg.summary.arrows': string;
  'dialog.svg.summary.components': string;
  'dialog.svg.summary.backgrounds': string;
  'dialog.autodraw.basicInfo': string;
  'dialog.autodraw.resources': string;
  'dialog.autodraw.chooseFile': string;
  'dialog.autodraw.advancedSettings': string;
  'dialog.autodraw.noJob': string;
  'dialog.autodraw.filterLogs': string;
  'dialog.autodraw.autoScroll': string;
  'dialog.autodraw.clearLogs': string;
  'dialog.autodraw.description': string;
  'dialog.autodraw.backendUrl': string;
  'dialog.autodraw.inputMode': string;
  'dialog.autodraw.modeGenerate': string;
  'dialog.autodraw.modeSourceFigure': string;
  'dialog.autodraw.modeGenerateHint': string;
  'dialog.autodraw.modeSourceHint': string;
  'dialog.autodraw.methodText': string;
  'dialog.autodraw.placeholder': string;
  'dialog.autodraw.referenceImage': string;
  'dialog.autodraw.sourceFigure': string;
  'dialog.autodraw.sourceFigureHint': string;
  'dialog.autodraw.sourceRunMode': string;
  'dialog.autodraw.sourceRunSegmented': string;
  'dialog.autodraw.sourceRunDirectSvg': string;
  'dialog.autodraw.sourceRunSegmentedHint': string;
  'dialog.autodraw.sourceRunDirectSvgHint': string;
  'dialog.autodraw.backgroundRemoval': string;
  'dialog.autodraw.backgroundRemovalOn': string;
  'dialog.autodraw.backgroundRemovalOff': string;
  'dialog.autodraw.backgroundRemovalHint': string;
  'dialog.autodraw.backgroundRemovalHintSkip': string;
  'dialog.autodraw.backgroundRemovalHintDirectSvg': string;
  'dialog.autodraw.uploadZip': string;
  'dialog.autodraw.bundleHint': string;
  'dialog.autodraw.existingJobId': string;
  'dialog.autodraw.existingJobPlaceholder': string;
  'dialog.autodraw.loadJob': string;
  'dialog.autodraw.provider': string;
  'dialog.autodraw.apiKey': string;
  'dialog.autodraw.baseUrl': string;
  'dialog.autodraw.imageModel': string;
  'dialog.autodraw.imageSize': string;
  'dialog.autodraw.imageSizeHint': string;
  'dialog.autodraw.samPrompt': string;
  'dialog.autodraw.samPromptHint': string;
  'dialog.autodraw.samPromptHintDirectSvg': string;
  'dialog.autodraw.svgModel': string;
  'dialog.autodraw.generate': string;
  'dialog.autodraw.cancel': string;
  'dialog.autodraw.cancelling': string;
  'dialog.autodraw.resume': string;
  'dialog.autodraw.copyJobId': string;
  'dialog.autodraw.copied': string;
  'dialog.autodraw.viewFlow': string;
  'dialog.autodraw.downloadBundle': string;
  'dialog.autodraw.rebuildJob': string;
  'dialog.autodraw.replayFromStage': string;
  'dialog.autodraw.replayFromHere': string;
  'dialog.autodraw.replayStageLabel': string;
  'dialog.autodraw.openAssetActions': string;
  'dialog.autodraw.assetActions': string;
  'dialog.autodraw.hideWorkbench': string;
  'dialog.autodraw.referenceGallery': string;
  'dialog.autodraw.galleryChooseFolder': string;
  'dialog.autodraw.galleryRefresh': string;
  'dialog.autodraw.galleryDisconnect': string;
  'dialog.autodraw.galleryDirectoryReady': string;
  'dialog.autodraw.galleryHint': string;
  'dialog.autodraw.galleryLive': string;
  'dialog.autodraw.galleryEmpty': string;
  'dialog.autodraw.galleryLoading': string;
  'dialog.autodraw.galleryUnsupported': string;
  'dialog.autodraw.galleryPermissionHint': string;
  'dialog.autodraw.galleryLoadFailed': string;
  'dialog.autodraw.galleryMissingSelection': string;
  'dialog.autodraw.manualReference': string;
  'dialog.autodraw.manualReferenceHint': string;
  'dialog.autodraw.selectedStyle': string;
  'dialog.autodraw.assetRoom': string;
  'dialog.autodraw.assetHint': string;
  'dialog.autodraw.assetHintLive': string;
  'dialog.autodraw.noAssets': string;
  'dialog.autodraw.openPreview': string;
  'dialog.autodraw.timeline': string;
  'dialog.autodraw.rawLogs': string;
  'dialog.autodraw.history': string;
  'dialog.autodraw.noHistory': string;
  'dialog.autodraw.clearHistory': string;
  'dialog.autodraw.deleteHistoryEntry': string;
  'dialog.autodraw.deleteHistoryPrompt': string;
  'dialog.autodraw.deleteHistoryHint': string;
  'dialog.autodraw.importMonitor': string;
  'dialog.autodraw.returnWorkbench': string;
  'dialog.autodraw.importWatchingHint': string;
  'dialog.autodraw.historyJob': string;
  'dialog.autodraw.historyLocal': string;
  'dialog.autodraw.statusLabel': string;
  'dialog.autodraw.jobId': string;
  'dialog.autodraw.failedStage': string;
  'dialog.autodraw.logMode': string;
  'dialog.autodraw.emptyLogs': string;
  'dialog.autodraw.summary.texts': string;
  'dialog.autodraw.summary.arrows': string;
  'dialog.autodraw.summary.components': string;
  'dialog.autodraw.workbench': string;
  'dialog.autodraw.activity': string;
  'dialog.autodraw.latestImport': string;
  'dialog.autodraw.readyHint': string;
  'dialog.autodraw.runningStageHint': string;
  'dialog.autodraw.referenceHint': string;
  'dialog.autodraw.stage.generateFigure': string;
  'dialog.autodraw.stage.parseStructure': string;
  'dialog.autodraw.stage.extractAssets': string;
  'dialog.autodraw.stage.rebuildSvg': string;
  'dialog.autodraw.stage.importCanvas': string;
  'dialog.autodraw.status.idle': string;
  'dialog.autodraw.status.queued': string;
  'dialog.autodraw.status.running': string;
  'dialog.autodraw.status.cancelling': string;
  'dialog.autodraw.status.submitting': string;
  'dialog.autodraw.status.importing': string;
  'dialog.autodraw.status.succeeded': string;
  'dialog.autodraw.status.cancelled': string;
  'dialog.autodraw.status.failed': string;
  'dialog.autodraw.error.noMethodText': string;
  'dialog.autodraw.error.noSourceFigure': string;
  'dialog.autodraw.error.submitFailed': string;
  'dialog.autodraw.error.cancelFailed': string;
  'dialog.autodraw.error.jobFailed': string;
  'dialog.autodraw.error.noBundle': string;
  'dialog.autodraw.error.logFailed': string;
  'dialog.error.loadMermaid': string;

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': string;
  'extraTools.markdownToDrawnix': string;
  'extraTools.autodraw': string;

  // Clean confirm dialog
  'cleanConfirm.title': string;
  'cleanConfirm.description': string;
  'cleanConfirm.cancel': string;
  'cleanConfirm.ok': string;

  // Link popup items
  'popupLink.delLink': string;

  // Tool popup items
  'popupToolbar.fillColor': string;
  'popupToolbar.fontFamily': string;
  'popupToolbar.fontSize': string;
  'popupToolbar.fontColor': string;
  'popupToolbar.link': string;
  'popupToolbar.cornerRadius': string;
  'popupToolbar.stroke': string;
  'popupToolbar.opacity': string;
  'popupToolbar.aiEditImage': string;
  'popupToolbar.replaceImage': string;

  // Icon library
  'iconLibrary.upload': string;
  'iconLibrary.uploading': string;
  'iconLibrary.empty': string;
  'iconLibrary.hint': string;
  'iconLibrary.remove': string;
  'assetLibrary.search': string;
  'assetLibrary.filter': string;
  'assetLibrary.filter.all': string;
  'assetLibrary.filter.image': string;
  'assetLibrary.filter.svg': string;
  'assetLibrary.filter.favorite': string;
  'assetLibrary.sort': string;
  'assetLibrary.sort.recent': string;
  'assetLibrary.sort.name': string;
  'assetLibrary.sort.size': string;
  'assetLibrary.sort.type': string;
  'assetLibrary.count': string;
  'assetLibrary.dropHint': string;
  'assetLibrary.emptyAction': string;
  'assetLibrary.noResults': string;
  'assetLibrary.unsupported': string;
  'assetLibrary.uploadFailed': string;
  'assetLibrary.type': string;
  'assetLibrary.source': string;
  'assetLibrary.source.local': string;
  'assetLibrary.source.ai': string;
  'assetLibrary.source.built-in': string;
  'assetLibrary.createdAt': string;
  'assetLibrary.size': string;
  'assetLibrary.insert': string;
  'assetLibrary.setSubject': string;
  'assetLibrary.subjectSet': string;
  'assetLibrary.favorite': string;
  'assetLibrary.unfavorite': string;
  'assetLibrary.download': string;
  'assetLibrary.rename': string;
  'assetLibrary.selectAsset': string;
  'assetLibrary.usage': string;

  // Text placeholders
  'textPlaceholders.link': string;
  'textPlaceholders.text': string;

  // Line tool
  'line.source': string;
  'line.target': string;
  'line.arrow': string;
  'line.none': string;
  'line.enableAnimation': string;
  'line.disableAnimation': string;

  // Stroke style
  'stroke.solid': string;
  'stroke.dashed': string;
  'stroke.dotted': string;

  //markdown example
  'markdown.example': string;

  // Draw elements text
  'draw.lineText': string;
  'draw.geometryText': string;

  // Mind map elements text
  'mind.centralText': string;
  'mind.abstractNodeText': string;

  // LLM Mermaid
  'toolbar.llmMermaid': string;
  'dialog.llmMermaid.title': string;
  'dialog.llmMermaid.chat': string;
  'dialog.llmMermaid.preview': string;
  'dialog.llmMermaid.placeholder': string;
  'dialog.llmMermaid.insert': string;
  'dialog.llmMermaid.close': string;

  // Image edit
  'dialog.imageEdit.title': string;
  'dialog.imageEdit.description': string;
  'dialog.imageEdit.prompt': string;
  'dialog.imageEdit.promptPlaceholder': string;
  'dialog.imageEdit.sourceImage': string;
  'dialog.imageEdit.backendUrl': string;
  'dialog.imageEdit.provider': string;
  'dialog.imageEdit.apiKey': string;
  'dialog.imageEdit.baseUrl': string;
  'dialog.imageEdit.imageModel': string;
  'dialog.imageEdit.removeBackground': string;
  'dialog.imageEdit.removeBackgroundHint': string;
  'dialog.imageEdit.generate': string;
  'dialog.imageEdit.close': string;
  'dialog.imageEdit.targetMissing': string;
  'dialog.imageEdit.overlayLabel': string;
  'dialog.imageEdit.status.idle': string;
  'dialog.imageEdit.status.submitting': string;
  'dialog.imageEdit.status.running': string;
  'dialog.imageEdit.status.succeeded': string;
  'dialog.imageEdit.status.failed': string;
  'dialog.imageEdit.error.noPrompt': string;
  'dialog.imageEdit.error.noTarget': string;
  'dialog.imageEdit.error.exportFailed': string;
  'dialog.imageEdit.error.submitFailed': string;
  'dialog.imageEdit.error.jobFailed': string;
  'dialog.imageEdit.error.noResult': string;

  'dialog.close': string;

  'tutorial.title': string;
  'tutorial.description': string;
  'tutorial.dataDescription': string;
  'tutorial.appToolbar': string;
  'tutorial.creationToolbar': string;
  'tutorial.themeDescription': string;
}

// I18n context interface
export interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof Translations) => string;
}

// Provider props
export interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
}
