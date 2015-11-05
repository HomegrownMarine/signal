module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      // define the files to lint
      files: ['gruntfile.js', 'run.js', 'www/js/signal/*'],
      // configure JSHint (documented at http://www.jshint.com/docs/)
      options: {
        // more options here if you want to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true
        },
        loopfunc: true,
        asi: true
      }
    },
    bowercopy: {
        options: {
            // Bower components folder will be removed afterwards 
            // clean: true
        },
        libs: {
            options: {
                destPrefix: 'www/js/lib'
            },
            files: {
                'jquery.js': 'jquery:main',
                'lodash.js': 'lodash:main',
                'moment.js': 'moment:main',
                'd3.js': 'd3:main',
                'async.js': 'async:main',
                'backbone.js': 'backbone:main',
                'chroma.js': 'chroma-js:main',
                'handlebars.js': 'handlebars:main'
            }
        },
        //
        homegrown: {
            files: {
                'www/js/homegrown-lib/polars.js': 'homegrown-polars:main',
                'www/js/homegrown-lib': 'homegrown-sailing/src/*.js'
            }
        }
    },

    concat: {
      options: {
        // define a string to put between each file in the concatenated output
        separator: ';',
        sourceMap: true
      },
      //libraries from homegrownmarine (this package and others)
      homegrown: {
        src: ['www/js/homegrown-lib/calcs.js', 
              'www/js/homegrown-lib/utilities.js', 
              'www/js/homegrown-lib/maneuvers.js', 
              'www/js/homegrown-lib/polars.js', 
              'www/js/signal/data.js', 
              'www/js/signal/graph.js', 
              'www/js/signal/map.js',
              'www/js/signal/tackView.js'
              ],
        dest: 'www/js/signal.js'
      },
      //global libraries
      libs: {
        src: ['www/js/lib/jquery.js',
              'www/js/lib/lodash.js',
              'www/js/lib/moment.js',
              'www/js/lib/d3.js',
              'www/js/lib/chroma.js',
              'www/js/lib/async.js',
              'www/js/lib/backbone.js',
              'www/js/lib/backbone.wreqr.js',
              'www/js/lib/backbone.babysitter.js',
              'www/js/lib/backbone.marionette.js',
              'www/js/lib/handlebars.js'],
        dest: 'www/js/lib.js'
      }
    },

    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
        sourceMap: true,
      },
      dest: {
        files: {
          'www/js/lib.min.js': ['www/js/lib.js'],
          'www/js/signal.min.js': ['www/js/signal.js']
        }
      }
    },

    less: {
      options: {
        sourceMap: true
      },
      prod: {
      files: {
        "www/css/race.css": "www/css/race.less"
      }
      }
    },

    watch: {
      files: ['www/js/signal/*.js','www/css/*.less'],
      tasks: ['homegrown']
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-bowercopy');

  // Default task(s).
  grunt.registerTask('homegrown', ['concat:homegrown', 'jshint', 'less']);
  grunt.registerTask('build', ['bowercopy', 'concat', 'uglify']);
  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('default', ['build']);

};