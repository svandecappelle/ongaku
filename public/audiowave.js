+function ($) {
    'use strict';

    function Audiowave (){

    }
    $.ongaku.audiowave = new Audiowave();

    Audiowave.prototype.rebuild = function () {

          // Future-proofing...
          var context;
          if (typeof AudioContext !== "undefined") {
              context = new AudioContext();
          } else if (typeof webkitAudioContext !== "undefined") {
              context = new webkitAudioContext();
          } else {
              $(".hideIfNoApi").hide();
              $(".showIfNoApi").show();
              return;
          }

          var lastTime = 0;
          var vendors = ['ms', 'moz', 'webkit', 'o'];
          for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
              window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
              window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame']
                                          || window[vendors[x] + 'CancelRequestAnimationFrame'];
          }

          if (!window.requestAnimationFrame)
              window.requestAnimationFrame = function (callback, element) {
                  var currTime = new Date().getTime();
                  var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                  var id = window.setTimeout(function () { callback(currTime + timeToCall); },
                      timeToCall);
                  lastTime = currTime + timeToCall;
                  return id;
              };

          if (!window.cancelAnimationFrame)
              window.cancelAnimationFrame = function (id) {
                  clearTimeout(id);
              };

          // Create the analyser
          var analyser = context.createAnalyser();
          //analyser.fftSize = 64;
         //var frequencyData = new Uint8Array(analyser.frequencyBinCount);

          // Set up the visualisation elements
          var visualisation = $("#visualisation");
          $("#visualisation").empty();
          $("#controls").bind('canplay', function() {
              console.log('ready');
          var source = context.createMediaElementSource(this);
          source.connect(analyser);
          analyser.connect(context.destination);
        });

          var frequencyData = new Uint8Array(200);

          var svgHeight = "" + visualisation.height();
          var svgWidth = "" + visualisation.width();
          var barPadding = '1';

          function createSvg(parent, height, width) {
            return d3.select(parent).append('svg').attr('height', height).attr('width', width);
          }

          var svg = createSvg('#visualisation', svgHeight, svgWidth);

          // Create our initial D3 chart.
          svg.selectAll('rect')
             .data(frequencyData)
             .enter()
             .append('rect')
             .attr('x', function (d, i) {
                return i * (svgWidth / frequencyData.length);
             })
             .attr('y', svgHeight)
             .attr('width', svgWidth / frequencyData.length - barPadding);


          // Continuously loop and update chart with frequency data.
          function renderChart() {
             requestAnimationFrame(renderChart);

             // Copy frequency data to frequencyData array.
             analyser.getByteFrequencyData(frequencyData);

             // Update d3 chart with new data.
             svg.selectAll('rect')
                .data(frequencyData)
                .attr('y', function(d) {
                   return  d === 0 ? svgHeight : svgHeight - ((d * 100) / svgHeight);
                })
                .attr('height', function(d) {
                   return  d === 0 ? 0 : ((d * 100) / svgHeight);
                })
                .attr('fill', function(d) {
                   return 'rgba(0, ' + d + ', 0, ' + (0.3 + (d / 255)) + ')';
                });
          }

          // Run the loop
          renderChart();
    };

}(jQuery);
