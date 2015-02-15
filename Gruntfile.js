module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      // define the files to lint
      files: ['gruntfile.js', 'run.js'],
      // configure JSHint (documented at http://www.jshint.com/docs/)
      options: {
        // more options here if you want to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true
        },
        loopfunc: true
      }
    },
    bowercopy: {
        options: {
            // Bower components folder will be removed afterwards 
            // clean: true
        },
        // libs: {
        //     options: {
        //         destPrefix: 'www/js/lib'
        //     },
        //     files: {
        //         'jquery.js': 'jquery:main',
        //         'lodash.js': 'lodash/dist/lodash.js',
        //         'moment.js': 'moment:main',
        //         'd3.js': 'd3:main',
        //         'backbone.js': 'backbone:main',
                
        //         'backbone.wreqr': 'backbone.wreqr:main',
        //         'backbone.babysitter.js': 'backbone.babysitter:main',
        //         'backbone.marionette.js': 'backbone.marionette:main',
        //         'handlebars.js': 'handlebars:main'
        //     }
        // },
        homegrown: {
            options: {
                destPrefix: 'www/js'
            },
            files: {
                'polars.js': 'homegrown-polars:main',
                'www/js': 'homegrown-sailing/src/*.js'
            }
        }
    },

    concat: {
      options: {
        // define a string to put between each file in the concatenated output
        separator: ';',
        sourceMap: true
      },
      local: {
        src: ['www/js/calcs.js', 
              'www/js/utilities.js', 
              'www/js/maneuvers.js', 
              'www/js/polars.js', 
              'www/js/data.js', 
              'www/js/graph.js', 
              'www/js/map.js'],
        // the location of the resulting JS file
        dest: 'www/signal.js'
      // },
      // libs: {
      //   src: ['www/js/lib/jquery.js',
      //         'www/js/lib/lodash.js',
      //         'www/js/lib/moment.js',
      //         'www/js/lib/d3.js',
      //         'www/js/lib/backbone.js',
      //         'www/js/lib/backbone.wreqr.js',
      //         'www/js/lib/backbone.babysitter.js',
      //         'www/js/lib/backbone.marionette.js',
      //         'www/js/lib/handlebars.js'],
      //   dest: 'www/lib.js'
      }
    },

    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
        sourceMap: true,
      },
      dest: {
        files: {
          'www/lib.min.js': ['www/lib.js'],
          'www/signal.min.js': ['www/signal.js']
        }
      }
    },
    watch: {
      files: ['www/js/*.js'],
      tasks: ['concat']
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-bowercopy');

  // Default task(s).
  grunt.registerTask('build', ['bowercopy', 'concat']);
  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('default', ['jshint']);

};