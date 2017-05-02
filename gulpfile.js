const gulp = require('gulp');
const babel = require('gulp-babel');
const rename = require('gulp-rename');
const del = require('del');
const mkdirp = require('mkdirp');

const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const gutil = require('gulp-util');
const babelify = require('babelify');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass');

const buildDir = "build";
const browserFile = "browser.js";
const packageConfig = require('./package.json');
const outputFile = packageConfig.name;
const outputFileSt = outputFile + ".js";
const outputFileMinSt = outputFile + '.min.js';

const standAlone = "pubmedSearch";

const cssFile = 'index.scss';

// will remove everything in build
gulp.task('clean', function() {
    return del([buildDir]);
});

// just makes sure that the build dir exists
gulp.task('init', ['clean'], function() {
    mkdirp(buildDir, function (err) {
        if (err) console.error(err);
    });
});


gulp.task('sass', function () {
    return gulp.src(cssFile)
        .pipe(sass({
            errLogToConsole: true
        }))
        .pipe(rename(outputFile + '.css'))
        .pipe(gulp.dest(buildDir));
});

gulp.task('build-browser', ['init', 'sass'], () => {
    return browserify({
        entries: browserFile,
        debug: true,
        standalone: standAlone,
    }).transform(babelify, {presets: ["es2015"], sourceMaps: true})
        .bundle()
        .pipe(source(outputFileSt))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        // .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(buildDir))
        .pipe(gutil.noop())
});

gulp.task('build-browser-min', ['build-browser'], () => {
    return browserify({
        entries: browserFile,
        debug: true,
        standalone: standAlone,
    }).transform(babelify, {presets: ["es2015"], sourceMaps: true})
        .bundle()
        .pipe(source(outputFileMinSt))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(buildDir))
        .pipe(gutil.noop())
});

gulp.task('build-all', ['build-browser-min']);