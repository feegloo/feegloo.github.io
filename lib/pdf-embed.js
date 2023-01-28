function embedPdf(filename, parentElementSelector) {
    function isMobile() {
        return !!navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|webOS)/);
    }

    function getEmbedElementString(fileName) {
        return `<embed src="${fileName}" width="100%"/>`
    }

    function appendHtmlElement(parentElement, htmlString) {
        parentElement.insertAdjacentHTML('beforeend', htmlString)
    }

    function appendEmbedPdf(filename, parentElement) {
        const embedElementString = getEmbedElementString(filename)

        appendHtmlElement(parentElement, embedElementString)  
    }

    // init
    const parentElement = document.querySelector(parentElementSelector)

    if (isMobile()) {
        const pagesPath = filename.replace('.pdf', '')

        // TODO: hardcoded
        appendEmbedPdf(`${pagesPath}/1.pdf`, parentElement)
        appendEmbedPdf(`${pagesPath}/2.pdf`, parentElement)        
    } else {
        appendEmbedPdf(filename, parentElement)
    }
}