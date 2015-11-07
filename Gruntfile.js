module.exports = function(grunt) {

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Automatically load required grunt tasks
  require('jit-grunt')(grunt, {
    useminPrepare: 'grunt-usemin'
  });

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
    
    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            'dist/*',
            '!dist/.git*'
          ]
        }]
      }
    },

    wiredep: {
      app: {
        src: ['www/race.html'],
        ignorePath: /^(\.\.\/)*\.\./
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
        sourceMap: true,
      }
    },
    // Reads HTML for usemin blocks to enable smart builds that automatically
    // concat, minify and revision files. Creates configurations in memory so
    // additional tasks can operate on them
    useminPrepare: {
      options: {
        dest: 'dist',
        flow: {
          steps: {
            js: ['concat']
          },
          post: {}
        }
      },
      html: 'www/race.html'
    },

    // Performs rewrites based on rev and the useminPrepare configuration
    usemin: {
      options: {
        assetsDirs: [
          'dist',
          'dist/css'
        ]
      },
      html: ['dist/{,*/}*.html'],
      css: ['dist/css/{,*/}*.css']
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
    filerev: {
      dist: {
        src: [
          'dist/scripts/{,*/}*.js',
          'dist/styles/{,*/}*.css',
          'dist/images/{,*/}*.*',
          'dist/styles/fonts/{,*/}*.*',
          'dist/*.{ico,png}'
        ]
      }
    },
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: 'www',
          dest: 'dist',
          src: [
            '*.{ico,png,txt}',
            'images/{,*/}*.webp',
            '{,*/}*.html',
            'css/{,*/}*.css'
          ]
        }]
      },
      data: {
        files: [{
          expand: true,
          dot: true,
          cwd: 'data',
          dest: 'dist/data',
          src: [
            '{,*/}*.js'
          ]
        }]
      }
    },

    watch: {
      files: ['www/js/signal/*.js','www/css/*.less'],
      tasks: ['homegrown']
    }
  });

  // Load the plugin that provides the "uglify" task.
  // grunt.loadNpmTasks('grunt-contrib-uglify');
  // grunt.loadNpmTasks('grunt-contrib-jshint');
  // grunt.loadNpmTasks('grunt-contrib-watch');
  // grunt.loadNpmTasks('grunt-contrib-concat');
  // grunt.loadNpmTasks('grunt-contrib-less');
  // grunt.loadNpmTasks('grunt-bowercopy');
  // grunt.loadNpmTasks('grunt-wiredep');

  // Default task(s).
  grunt.registerTask('homegrown', ['concat:homegrown', 'jshint', 'less']);
  grunt.registerTask('build', ['bowercopy', 'concat', 'uglify']);
  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('default', ['build']);
  grunt.registerTask('prod', [
    'clean:dist',
    'less',
    'wiredep',
    'useminPrepare',
    'concat',
    'uglify',
    // 'filerev',    
    'copy:dist',
    'usemin',
    'copy:data'
  ]);

};