function embedPdf(filename, parentElementSelector) {
    // utils
    function isMobile() {
        return !!navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|webOS)/);
    }

    function isLocalhost() {
        return document.location.origin === 'file:/'
    }

    function appendHtmlElement(parentElement, htmlString) {
        parentElement.insertAdjacentHTML('beforeend', htmlString)
    }

    function embedPdfDesktop(filename, parentElement) {
        const elementString = `<embed src="${filename}" width="100%" height="100%"/>`

        appendHtmlElement(parentElement, elementString)
    }

    function getFileUrl(filename) {
        return isLocalhost() ? filename : document.location.origin + "/" + filename
    }

    function embedPdfMobile(fileUrl, parentElement) {                
        const elementString = `<iframe src="https://docs.google.com/viewer?url=${fileUrl}&embedded=true" style="width: 100%;height:100%;" frameborder="O"></iframe>`

        appendHtmlElement(parentElement, elementString)        
    }

    // init
    const parentElement = document.querySelector(parentElementSelector)

    if (isMobile()) {
        const fileUrl = getFileUrl(filename)
        embedPdfMobile(fileUrl, parentElement)
    }
    else embedPdfDesktop(filename, parentElement)
}
