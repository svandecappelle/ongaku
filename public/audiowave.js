+function ($) {
    'use strict';

    function Audiowave (){

    }
    $.ongaku.audiowave = new Audiowave();

    Audiowave.prototype.rebuild = function () {
          // Future-proofing...
          var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          var audioElement = document.getElementById('controls');
          var audioSrc = audioCtx.createMediaElementSource(audioElement);
          var analyser = audioCtx.createAnalyser();

          // Bind our analyser to the media element source.
          audioSrc.connect(analyser);
          audioSrc.connect(audioCtx.destination);

          // Create the analyser
          var frequencyData = new Uint8Array(200);

          // Set up the visualisation elements
          var visualisation = $("#visualisation");
          $("#visualisation").empty();
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
