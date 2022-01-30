function getEmbedPdf(clientIdAdobePdfEmbedAPI) {
  /** 
   * utils 
   */
  function isMobile() {
    navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|webOS)/);
  }

  function appendHtmlElement(parentElement, htmlString) {
    parentElement.insertAdjacentHTML('beforeend', htmlString)
  }

  /** 
   * native pdf reader (without libraries) 
   */
  var runNativeEmbedPdf = (function() {
    function getEmbedElementString(fileName) {
      return '<embed src="' + fileName + '" width="100%" height="100%"/>'
    }
    
    return function(fileName, parentElement) {
      console.log('runNativeEmbedPdf')
      var embedElementString = getEmbedElementString(fileName)
  
      appendHtmlElement(parentElement, embedElementString)      
    }
  })();
  
  /** 
   * Adobe PDF Embed API 
   * 
   * solves native pdf problem - iOS cannot display multiple page PDF (displays only first page as image)
   */
  var runAdobePdfEmbedAPI = (function() {
    var containerElementId = 'adobe-dc-view'

    function getSdkScriptElementString() {
      return '<script src="https://documentcloud.adobe.com/view-sdk/main.js"></script>'
    }

    function getContainerElementString() {
      return '<div id="' + containerElementId + '"></div>'
    }

    function getMetaViewportElementString() {
      return '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>'
    }

    function initSdk(clientId, fileName, divId) {
      document.addEventListener("adobe_dc_view_sdk.ready", function() { 
        var adobeDCView = new AdobeDC.View({clientId: clientId, divId: divId});
        
        // only sibling file - no support for relatvie / absolute path
        var url = document.location.origin + "/" + fileName

        var options = {
          embedMode: "IN_LINE",
          defaultViewMode: "CONTINUOUS", 
          showPageControls: false, 
          showAnnotationTools: false, 
          showLeftHandPanel: false
        }
        
        adobeDCView.previewFile({
          content:{
            location: {
              url: url
            }
          },
          metaData:{
            fileName: fileName
          }
        }, options);
      });
    }

    return function(clientId, fileName, parentElement) {      
      appendHtmlElement(parentElement, getSdkScriptElementString())
      appendHtmlElement(parentElement, getContainerElementString())
      appendHtmlElement(document.querySelector('head'), getMetaViewportElementString())

      initSdk(clientId, fileName, containerElementId)
    }
  })();

  /** 
   * client API 
   */
  return function(fileName, parentElementSelector) {
    var parentElement = document.querySelector(parentElementSelector)

    if (isMobile()) runAdobePdfEmbedAPI(clientIdAdobePdfEmbedAPI, fileName, parentElement)
    else runNativeEmbedPdf(fileName, parentElement)
  }
} 