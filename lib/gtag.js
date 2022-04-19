(function () {
    function getScriptElement(src) {
        var script   = document.createElement("script");

        script.type  = "text/javascript";
        script.src   = src;
        script.async = true;    // TODO: 2-nd param {async : true}
        
        return script
    }

    function initDataLayer() {
        window.dataLayer = window.dataLayer || [];

        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', 'G-FT1KCDMZJQ');
    }

    function init() {
        initDataLayer();

        var headElement = document.querySelector('head')
        var script = getScriptElement('https://www.googletagmanager.com/gtag/js?id=G-FT1KCDMZJQ')

        headElement.appendChild(script)              
    }

    init();
})();

