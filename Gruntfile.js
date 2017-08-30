module.exports = function (grunt) {
  grunt.initConfig({
    jshint: {
      files: ['Gruntfile.js', 'src/**/*.js', 'public/lib/**/*.js'],
      options: {
        globals: {
          jQuery: true
        }
      }
    },
    concat: {
      css: {
        src: ['public/assets/main.min.css', 'public/assets/chat.min.css', 'public/assets/media-theme.min.css', 'public/assets/video-js-ongaku-theme.min.css'],
        dest: 'public/assets/application.min.css'
      },
      js: {
        src: ['public/assets/app.min.js', 'public/assets/chat.min.js', 'public/assets/audiowave.min.js', 'public/assets/init.min.js'],
        dest: 'public/assets/application.min.js'
      }
    },
    cssmin: {
      target: {
        files: grunt.file.expandMapping(['public/lib/*.css'], 'public/assets/', {
          rename: function (destBase, destPath) {
            return destBase + destPath.replace('public/lib/', '').replace('.css', '.min.css');
          }
        })
      }
    },
    uglify: {
      prod: {
        files: grunt.file.expandMapping(['public/lib/*.js'], 'public/assets/', {
          rename: function (destBase, destPath) {
            return destBase + destPath.replace('public/lib/', '').replace('.js', '.min.js');
          }
        }),
        options: {
          mangle: false
        }
      }
    },
    docco: {
      debug: {
        src: ['src/**/*.js'],
        options: {
          output: 'docs/'
        }
      }
    },
    nwjs: {
      options: {
        platforms: ['linux'],
        buildDir: './build',
        flavor: 'normal'
      },
      src: ['./**/*'] // Your node-webkit app
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-docco-dir');
  grunt.loadNpmTasks('grunt-nw-builder');

  grunt.registerTask('doc', ['concat']);
  grunt.registerTask('quality', ['concat']);
  grunt.registerTask('default', ['uglify', 'cssmin', 'concat']);
  grunt.registerTask('desktop', ['nwjs']);
};
