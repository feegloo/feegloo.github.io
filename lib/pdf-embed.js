function embedPdf(filename, parentElementSelector = 'body') {
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

    function setMobileViewport() {
        const elementString = '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>'
        const headElement = document.querySelector('head')

        appendHtmlElement(headElement, elementString)
    }

    function getFileUrl(filename) {
        return isLocalhost() ? filename : document.location.href + filename
    }

    function embedPdfMobile(fileUrl, parentElement) {                
        const elementString = `<iframe src="https://docs.google.com/viewer?url=${fileUrl}&embedded=true" style="width: 100%;height:100%; margin-bottom: 30px;" frameborder="O"></iframe>`

        appendHtmlElement(parentElement, elementString)        
    }

    // init
    addEventListener('DOMContentLoaded', () => {
        const parentElement = document.querySelector(parentElementSelector)

        if (isMobile()) {
            const fileUrl = getFileUrl(filename)
            embedPdfMobile(fileUrl, parentElement)
            setMobileViewport()
        }
        else embedPdfDesktop(filename, parentElement)
    })
}
