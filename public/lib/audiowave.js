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
    // TODO check if the timeout is necessary for the improves performances.
    //setTimeout(function(){
    requestAnimationFrame(render);
    //}, 50);
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
        var color = $.ongaku.audiowave.getColor();

        if (!color){
          color = 'rgba(0, ' + d + ', 0, ' + (d / 255) + ')';
        } else if (color.match("rgba*")){
          var hue,
            colorArray = color.split(",");
          color = "";
          for (var i = 0; i < colorArray.length; i++) {
            hue = colorArray[i];
            if (i > 2){
              break;
            }
            color += hue.concat(",");
          }
          color += "" + (d / 255)+ ')';
        }
        return color;
      });
  }

  function Audiowave() {
    this.binded = false;

    this.numberFrequency = 200;

    // TO GET A FULL RENDER (USING ONLY COLOR SET MAX FREQ TO 100)
    // Default value is 255
    this.maxFrenquency = 255;
    this.render = render;
    this.color = "rgba(0, 255, 0, 1)";
  }

  $.ongaku.audiowave = new Audiowave();

  Audiowave.prototype.rebuildSVG = function(parent, height, width) {
    return d3.select(parent).append('svg').attr('height', height).attr('width', width);
  };

  Audiowave.prototype.setColor = function(color) {
    this.color = color;
  };

  Audiowave.prototype.getColor = function() {
    return this.color;
  };

  Audiowave.prototype.rebuild = function() {
    var that = this;

    if (!this.binded) {
      var savedColor = Cookies.get("base-color");
      if (savedColor){
        this.setColor(savedColor)
      }
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
      this.frequencyData = new Uint8Array(that.numberFrequency);

      // Set up the visualisation elements
      this.visualisation = $("#visualisation");
      this.visualisation.empty();

      $("#ticks-frequency").slider({
        step: 5,
        min: 1,
        max: 200,
        value: 200
      }).on( "slidechange", function( event, ui ) {
        console.log("ui change slide:" + ui.value);
        that.numberFrequency = ui.value;
        that.frequencyData = new Uint8Array(that.numberFrequency);
        that.svg.selectAll('rect').remove();
        that.svg.selectAll('rect')
          .data(that.frequencyData)
            .enter()
            .append('rect')
            .attr('x', function(d, i) {
              return i * (that.svgWidth / that.frequencyData.length);
            })
            .attr('width', that.svgWidth / that.frequencyData.length - that.barPadding);

      });
      $(".pending-list").resizable({
        handles: {
            'n': '#handle'
        }
      });
      $(".pending-list").on("resize", function(){
        that.svgHeight = "" + that.visualisation.height();
        $("#visualisation svg").attr('height', that.svgHeight);
      });
      if (!this.visualisation.is(":hidden")){

        this.svgHeight = this.visualisation.height();
        this.svgWidth = this.visualisation.width();
        this.barPadding = '1';
        console.log(this.visualisation.height());

        if (this.svgHeight === 0){
          this.svgHeight = 50;
        }

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
    }
  };
}(jQuery);
