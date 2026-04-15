// this component displays an image with the width of the parent element and on hover shows
// the full image or a scaled image in the image area.
// features: activate/deactivate method, active/inactive on load, scale parameter, separate zoom image,
// event when all images loaded, event when images resized (responsive css, etc),
// clickable-colors detection: when cursor stops over a pixel whose color matches one of the
// provided hex values (within colorTolerance), the cursor changes to "pointer" and a
// "box-click" event is emitted on click.

function pageOffset(el) {
  // -> {x: number, y: number}
  // get the left and top offset of a dom block element
  var rect = el.getBoundingClientRect(),
    scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
    scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return {
    y: rect.top + scrollTop,
    x: rect.left + scrollLeft
  }
}

var MOVE_STOP_DELAY_MS = 150 // ms of cursor stillness before running the clickable check

var zoomOnHover = {
  props: ["imgNormal", "imgZoom", "scale", "disabled", "clickableColors", "colorTolerance"],
  template: `<div class="zoom-on-hover" v-bind:class="{zoomed}" @touchstart="touchzoom"
    @mousemove="move" @mouseenter="zoom" @mouseleave="unzoom" @click="handleClick">
    <img class="normal" ref="normal" :src="imgNormal"/>
    <img class="zoom" ref="zoom" :src="imgZoom || imgNormal"/></div>`,
  data: function() {
    return {
      scaleFactor: 1,
      resizeCheckInterval: null,
      zoomed: false,
      imageCanvas: null,
      imageCtx: null,
      currentImageX: 0,
      currentImageY: 0,
      isOnClickable: false,
      moveStopTimer: null
    }
  },
  methods: {
    touchzoom: function(event) {
      if (this.disabled) return
      this.move(event)
      this.zoomed = !this.zoomed
    },
    zoom: function() {
      if (!this.disabled) this.zoomed = true
    },
    unzoom: function() {
      if (!this.disabled) {
        this.zoomed = false
        this.isOnClickable = false
        this.$el.style.cursor = ''
        clearTimeout(this.moveStopTimer)
      }
    },
    move: function(event) {
      if (this.disabled || !this.zoomed) return
      var offset = pageOffset(this.$el)
      var zoom = this.$refs.zoom
      var normal = this.$refs.normal
      var relativeX = event.clientX - offset.x + window.pageXOffset
      var relativeY = event.clientY - offset.y + window.pageYOffset
      var normalFactorX = relativeX / normal.offsetWidth
      var normalFactorY = relativeY / normal.offsetHeight
      var x = normalFactorX * (zoom.offsetWidth * this.scaleFactor - normal.offsetWidth)
      var y = normalFactorY * (zoom.offsetHeight * this.scaleFactor - normal.offsetHeight)
      zoom.style.left = -x + "px"
      zoom.style.top = -y + "px"

      // Track actual pixel coordinates on the source image (0..naturalWidth, 0..naturalHeight)
      this.currentImageX = normalFactorX * normal.naturalWidth
      this.currentImageY = normalFactorY * normal.naturalHeight

      // Throttled "mouse stopped" check for clickable detection
      if (this.clickableColors && this.clickableColors.length && this.imageCtx) {
        clearTimeout(this.moveStopTimer)
        var component = this
        this.moveStopTimer = setTimeout(function() {
          var onClickable = component.checkClickableAtPosition(component.currentImageX, component.currentImageY)
          component.isOnClickable = onClickable
          component.$el.style.cursor = onClickable ? 'pointer' : ''
        }, MOVE_STOP_DELAY_MS)
      }
    },
    handleClick: function() {
      if (this.zoomed && this.isOnClickable) {
        this.$emit('box-click', {
          x: Math.round(this.currentImageX),
          y: Math.round(this.currentImageY)
        })
      }
    },
    hexToRgb: function(hex) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    },
    checkClickableAtPosition: function(imageX, imageY) {
      if (!this.imageCtx || !this.clickableColors || !this.clickableColors.length) return false
      var x = Math.round(imageX)
      var y = Math.round(imageY)
      if (x < 0 || y < 0 || x >= this.imageCanvas.width || y >= this.imageCanvas.height) return false
      var tolerance = this.colorTolerance !== undefined ? Number(this.colorTolerance) : 30
      try {
        var pixel = this.imageCtx.getImageData(x, y, 1, 1).data
        var r = pixel[0], g = pixel[1], b = pixel[2]
        var component = this
        return this.clickableColors.some(function(hex) {
          var target = component.hexToRgb(hex)
          if (!target) return false
          return Math.abs(r - target.r) <= tolerance &&
                 Math.abs(g - target.g) <= tolerance &&
                 Math.abs(b - target.b) <= tolerance
        })
      } catch(e) {
        return false
      }
    },
    drawImageToCanvas: function() {
      var img = this.$refs.normal
      if (!img || !img.naturalWidth) return
      var canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      var ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      this.imageCanvas = canvas
      this.imageCtx = ctx
    },
    initEventLoaded: function() {
      // emit the "loaded" event if all images have been loaded
      var promises = [this.$refs.zoom, this.$refs.normal].map(function(image) {
        return new Promise(function(resolve, reject) {
          if (image.complete) {
            resolve()
          } else {
            image.addEventListener("load", resolve)
            image.addEventListener("error", reject)
          }
        })
      })
      var component = this
      Promise.all(promises).then(function() {
        component.$emit("loaded")
        component.drawImageToCanvas()
      })
    },
    initEventResized: function() {
      var normal = this.$refs.normal
      var previousWidth = normal.offsetWidth
      var previousHeight = normal.offsetHeight
      var component = this
      this.resizeCheckInterval = setInterval(function() {
        if ((previousWidth != normal.offsetWidth) || (previousHeight != normal.offsetHeight)) {
          previousWidth = normal.offsetWidth
          previousHeight = normal.offsetHeight
          component.$emit("resized", {
            width: normal.width,
            height: normal.height,
            fullWidth: normal.naturalWidth,
            fullHeight: normal.naturalHeight
          })
        }
      }, 1000)
    }
  },
  mounted: function() {
    if (this.$props.scale) {
      this.scaleFactor = this.$props.scale
      this.$refs.zoom.style.transform = "scale(" + this.scaleFactor + ")"
    }
    this.initEventLoaded()
    this.initEventResized()
  },
  updated: function() {
    this.initEventLoaded()
  },
  beforeDestroy: function() {
    this.resizeCheckInterval && clearInterval(this.resizeCheckInterval)
    clearTimeout(this.moveStopTimer)
  }
}
