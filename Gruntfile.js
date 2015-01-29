module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      dist: {
        files: {
          'www/js/lib.min.js': ['www/js/lib.js']
        }
      }
    },
    concat: {
      options: {
        // define a string to put between each file in the concatenated output
        separator: ';'
      },
      dist: {
        // the files to concatenate
        src: ['src/**/*.js'],
        // the location of the resulting JS file
        dest: 'dist/polars.js'
      }
    },
    jshint: {
      // define the files to lint
      files: ['gruntfile.js', 'run.js', 'src/**/*.js', 'test/**/*.js'],
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
    bower_concat: {
      all: {
        dest: 'www/js/lib.js',
        exclude: [
        	'underscore'
        ],
        dependencies: {
          'lodash': 'jquery',
          'backbone': 'lodash',
          'backbone.marionette': 'backbone'
        },
        bowerOptions: {
          relative: false
        }
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['jshint']
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-bower-concat');

  // Default task(s).
  grunt.registerTask('setup', ['bower_concat', 'uglify']);
  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('default', ['concat','uglify']);

};