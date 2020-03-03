const gulp = require('gulp');
const ts = require('gulp-typescript');
const stylus = require('gulp-stylus');
const sourcemaps = require('gulp-sourcemaps');
const changed = require('gulp-changed');
const del = require('del');

const SRC_PATH = 'src';
const DEST_PATH = 'build';
const VENDOR_PATH = 'vendors';


const copyPath = [
    `${SRC_PATH}/**/!(_)*.*`,
    `!${SRC_PATH}/**/*.styl`,
    `!${SRC_PATH}/**/*.ts`
];

const tsPath = [`${SRC_PATH}/**/*.ts`, `${SRC_PATH}/app.ts`];
const stylusPath = [`${SRC_PATH}/**/*.styl`];


gulp.task("copyVendors", () => {
    return gulp.src(`${VENDOR_PATH}/**/*`).pipe(gulp.dest(`${DEST_PATH}/${VENDOR_PATH}`));
});

gulp.task("fullCopy", () => {
    return gulp.src(copyPath).pipe(gulp.dest(DEST_PATH));
});

gulp.task("copyChanged", () => {
    return gulp
        .src(copyPath)
        .pipe(changed(DEST_PATH))
        .pipe(gulp.dest(DEST_PATH));
});

const tsProject = ts.createProject("tsconfig.json");

gulp.task("tsc", function () {
    return gulp.src(tsPath)
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .js
        .pipe(sourcemaps.write()) // 添加sourcemap
        .pipe(gulp.dest(DEST_PATH)); // 最终输出到dist目录对应的位置
});

gulp.task("stylus", function () {
    return gulp.src(stylusPath)
        .pipe(sourcemaps.init())
        .pipe(stylus())
        .pipe(sourcemaps.write()) // 添加sourcemap
        .pipe(gulp.dest(DEST_PATH)); // 最终输出到dist目录对应的位置
});

gulp.task("watch", () => {
    const watcher1 = gulp.watch(tsPath, gulp.series("tsc")); // ts编译
    const watcher2 = gulp.watch(copyPath, gulp.series("copyChanged")); // 复制任务
    const watcher3 = gulp.watch(stylusPath, gulp.series("stylus")); // less处理
    const watcher4 = gulp.watch(VENDOR_PATH, gulp.series("copyVendors")); 
    
    function deleteTheFile(event) {
        // 删除的时候，也更新删除任务到目标文件夹
        if (event.type === "deleted") {
            let filepath = event.path;
            let filePathFromSrc = path.relative(path.resolve(SRC_PATH), filepath);
            // Concatenating the 'build' absolute path used by gulp.dest in the scripts task
            let destFilePath = path.resolve(DEST_PATH, filePathFromSrc);
            del.sync(destFilePath);
        }
    };
    // watcher1.on("change", deleteTheFile);
    watcher2.on("change", deleteTheFile);
    // watcher3.on("change", deleteTheFile);
});

gulp.task('clean', function () {
    return del([
        `${DEST_PATH}/**/*`
    ]);
});

// dev && watch
gulp.task(
    "default",
    gulp.series(
        // sync
        gulp.parallel("copyVendors", "fullCopy", "tsc", "stylus"),
        "watch"
    )
);

// build
gulp.task(
    "build",
    gulp.series( // 串行任务
        // sync
        "clean",
        gulp.parallel( // 并行任务
            // async
            "copyVendors",
            "fullCopy",
            "tsc",
            "stylus"
        )
    )
);
