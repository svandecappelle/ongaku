+ function($) {

  var lastTime = 0;
  var vendors = ['webkit', 'moz'];
  for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
    window.cancelAnimationFrame =
      window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
      var currTime = new Date().getTime();
      var timeToCall = Math.max(0, 16 - (currTime - lastTime));
      var id = window.setTimeout(function() {
          callback(currTime + timeToCall);
        },
        timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };

  if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
  };



  function render() {
    var audiowave = $.ongaku.audiowave;
    // requestAnimationFrame(this.getRenderer);
    setTimeout(function(){
      requestAnimationFrame(render);
    }, 50);

    // Copy frequency data to frequencyData array.
    audiowave.analyser.getByteFrequencyData(audiowave.frequencyData);

    // Update d3 chart with new data.
    audiowave.svg.selectAll('rect')
      .data(audiowave.frequencyData)
      .attr('y', function(d) {
        return d === 0 ? audiowave.svgHeight : audiowave.svgHeight - ((d * audiowave.svgHeight) / audiowave.maxFrenquency);
      })
      .attr('height', function(d) {
        return d === 0 ? 0 : ((d * audiowave.svgHeight) / audiowave.maxFrenquency);
      })
      .attr('fill', function(d) {
        return 'rgba(0, ' + d + ', 0, ' + (0.3 + (d / 255)) + ')';
      });
  }

  function Audiowave() {
    this.binded = false;

    // TO GET A FULL RENDER (USING ONLY COLOR SET MAX FREQ TO 100)
    // Default value is 255
    this.maxFrenquency = 255;
    this.render = render;
  }

  $.ongaku.audiowave = new Audiowave();

  Audiowave.prototype.rebuildSVG = function(parent, height, width) {
    return d3.select(parent).append('svg').attr('height', height).attr('width', width);
  };

  Audiowave.prototype.rebuild = function() {
    var that = this;

    if (!this.binded) {
      this.binded = true;

      if (window.AudioContext) {
        this.audioCtx = new window.AudioContext();
      } else if (window.webkitAudioContext) {
        this.audioCtx = new window.webkitAudioContext();
      }

      this.audioElement = document.getElementById('controls');
      this.audioSrc = this.audioCtx.createMediaElementSource(this.audioElement);

      this.analyser = this.audioCtx.createAnalyser();

      // Bind our analyser to the media element source.
      this.audioSrc.connect(this.analyser);
      this.audioSrc.connect(this.audioCtx.destination);

      // Create the analyser
      this.frequencyData = new Uint8Array(200);

      // Set up the visualisation elements
      this.visualisation = $("#visualisation");
      this.visualisation.empty();
      this.svgHeight = "" + this.visualisation.height();
      this.svgWidth = "" + this.visualisation.width();
      this.barPadding = '1';

      this.svg = this.rebuildSVG('#visualisation', this.svgHeight, this.svgWidth);

      // Create our initial D3 chart.
      this.svg.selectAll('rect')
        .data(that.frequencyData)
        .enter()
        .append('rect')
        .attr('x', function(d, i) {
          return i * (that.svgWidth / that.frequencyData.length);
        })
        .attr('width', that.svgWidth / that.frequencyData.length - that.barPadding);

      this.render();
    }
  };
}(jQuery);
