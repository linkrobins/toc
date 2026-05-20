<?php

use Flarum\Extend;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    new Extend\Locales(__DIR__ . '/locale'),

    (new Extend\Settings())
        ->default('linkrobins-toc.max_depth', '3')
        ->default('linkrobins-toc.min_headings', '2')
        ->serializeToForum('linkrobinsTocMaxDepth',    'linkrobins-toc.max_depth')
        ->serializeToForum('linkrobinsTocMinHeadings', 'linkrobins-toc.min_headings'),
];
