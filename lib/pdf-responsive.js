function getEmbedPdf(clientIdAdobePdfEmbedAPI) {
  /** 
   * utils 
   */
  function isMobile() {
    return !!navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|webOS)/);
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
      var embedElementString = getEmbedElementString(fileName)
  
      appendHtmlElement(parentElement, embedElementString)      
    }
  })();
  
  /** 
   * Pdf.js
   * 
   * Responsive for mobile
   */
  var runPdfJsResponsive = (function() {
    // TODO: PDF.js implementation with responsiveness

    // <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.13.216/pdf.min.js" integrity="sha512-IM60GPudO4jk+ZQm3UlJgKHhXQi5pNDM6mP+pLKL968YgkHMc7He3aGJOVHEZ9rJ4vAaEtJ8W6SKa7Qq4inzBA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    // result
    return function(fileName, parentElement) {    
      
    }
  })();

  /** 
   * client API 
   */
  return function(fileName, parentElementSelector) {
    var parentElement = document.querySelector(parentElementSelector)

    if (isMobile()) runPdfJsResponsive(fileName, parentElement)
    else runNativeEmbedPdf(fileName, parentElement)
  }
} 