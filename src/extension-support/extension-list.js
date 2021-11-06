const builtinExtensions = {
    // This is an example that isn't loaded with the other core blocks,
    // but serves as a reference for loading core blocks as extensions.
    'coreExample': () => require('../blocks/scratch3_core_example'),
    // These are the non-core built-in extensions.
    'pen': () => require('../extensions/scratch3_pen'),
    'wedo2': () => require('../extensions/scratch3_wedo2'),
    'music': () => require('../extensions/scratch3_music'),
    'microbit': () => require('../extensions/scratch3_microbit'),
    'text2speech': () => require('../extensions/scratch3_text2speech'),
    'translate': () => require('../extensions/scratch3_translate'),
    'videoSensing': () => require('../extensions/scratch3_video_sensing'),
    'ev3': () => require('../extensions/scratch3_ev3'),
    'makeymakey': () => require('../extensions/scratch3_makeymakey'),
    'boost': () => require('../extensions/scratch3_boost'),
    'gdxfor': () => require('../extensions/scratch3_gdx_for'),
    'libra': () => require('../extensions/scp_libra'),
    'httpio': () => require('../extensions/clip_httpio'),
    'ccjson': () => require('../extensions/clipcc_json'),
    'clipblocks': () => require('../extensions/clipblocks')
}

class ExtensionList {
    constructor () {
        
    }
    
    getExtensionList () {
        let extensionList = [];
        Object.keys(builtinExtensions).forEach(function(extension){
            extensionList.push(extension);
        });
        return extensionList;
    }

    isExtensionExists (extensionID) {
        if (!this.listCache) this.listCache = this.getExtensionList();
        for (let extension of this.listCache) {
            if (extensionID == extension) return true;
        }
        return false;
    }
}

module.exports = {
    builtinExtensions,
    ExtensionList
}