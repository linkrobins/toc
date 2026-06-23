import app from 'flarum/admin/app';

// max_depth and min_headings were registered + serialized to the forum but had
// no admin UI, so the only way to change them was a raw settings UPDATE. Expose
// both as number settings on the extension page.
app.initializers.add('linkrobins-toc', () => {
  app.registry
    .for('linkrobins-toc')
    .registerSetting({
      setting: 'linkrobins-toc.max_depth',
      type: 'number',
      min: 1,
      max: 3,
      label: app.translator.trans('linkrobins-toc.admin.settings.max_depth_label'),
      help: app.translator.trans('linkrobins-toc.admin.settings.max_depth_help'),
    })
    .registerSetting({
      setting: 'linkrobins-toc.min_headings',
      type: 'number',
      min: 1,
      max: 20,
      label: app.translator.trans('linkrobins-toc.admin.settings.min_headings_label'),
      help: app.translator.trans('linkrobins-toc.admin.settings.min_headings_help'),
    });
});
