const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

function MyDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

let createMainLayoutWithItems = function (config) {
  let window = new St.BoxLayout({
    vertical: true,
    width: config.width,
    height: config.height,
    styleClass: "arken-menu-window"
  });

  config.items.forEach((item) => window.add(item));
  return window;
};

let createLabel = function(label, cssClass) {
  return new St.Label({
    text: label,
    styleClass: cssClass
  });
};

MyDesklet.prototype = {
  __proto__: Desklet.Desklet.prototype,

  _init: function(metadata, desklet_id) {
      Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

      this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, desklet_id);
      this.settings.bindProperty(Settings.BindingDirection.IN, "height", "height", this.onSettingsChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "width", "width", this.onSettingsChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "url", "url", this.onSettingsChanged, null);

      this.showMessage('Loading...');
      this.refresh();

      this.timeout = Mainloop.timeout_add_seconds(2*3600, Lang.bind(this, this.refresh));
      // only update, if the desklet is running
      this.keepUpdating = true;
  },


  getUIConfig () {
    return {
      height: this.height,
      width: this.width,
      items: this.layoutItems || []
    };
  },

  updateUI(){
    const today = new Date().toLocaleDateString('sv-SE')
    this.setHeader(`Arken menu ${today}`)

    const config = this.getUIConfig();

    this.window = createMainLayoutWithItems(config);
    this.setContent(this.window);
  },

  getMenuData () {
    this.showMessage('Loading...');
    const request = Gio.file_new_for_uri(this.url);

    request.load_contents_async(null, Lang.bind(this, (obj, res) => {
      try {
          const [success, contents] = obj.load_contents_finish(res);
          if (success) {
              this.handleResponse(contents.toString());
              this._error = false;
          } else {
              global.logError("Could not load url");
              this._error = true;
          }
      } catch (e) {
          global.logError("Error while loading url: " + e.message);
          this._error = true;
      }
    }));

  },

  handleResponse (response) {
    const flattenedText = response.replace(/\r|\n|\t/g, '');

    const titles = this.__extractValues(flattenedText, 'element title');
    const descr  = this.__extractValues(flattenedText, 'element show-description description');


    if (titles?.length) {
      global.log('Found menu items', titles)

      this.layoutItems = titles.reduce((result, title, idx) => {
        result.push(createLabel(title, 'arken-menu-item-title'));

        if (descr && descr[idx]) {
          result.push(createLabel(descr[idx], 'arken-menu-item-description'));
        }

        return result
      }, [])

      this.layoutItems.push(createLabel(`Updated at: ${new Date().toLocaleString('sv')}`, 'arken-menu-footer'))
    } else {
      global.log('No menu available')
      this.layoutItems = [
        createLabel('No menu available', 'arken-menu-item-description')
      ]
    }

    this.updateUI()
  },

  refresh: function() {
    this.getMenuData()

    return this.keepUpdating;
  },

  showMessage(msg) {
    this.layoutItems = [
      createLabel(msg, '')
    ];

    this.updateUI();
  },

  on_desklet_clicked: function() {
    this.getMenuData()
  },

  onSettingsChanged() {
    this.window.set_size(this.width, this.height);
  },

  on_desklet_removed: function() {
    // if the desklet is removed, stop updating, stop Mainloop
    this.keepUpdating = false;
    if (this.timeout) Mainloop.source_remove(this.timeout);
    this.timeout = 0;
  },

  __extractValues (html, selector) {
    const matcher = `<div class="${selector} [\\\w-\\\s]*">([\\\sa-zA-ZäöåÄÖÅé\\\-.,&;]*)<\\\/div>`;
    const regex = new RegExp(matcher);

    const found = html.match(new RegExp(matcher, 'g'));

    return found?.map(str => {
      const matched = str.match(regex)

      return matched && matched[1]
        .replace(/&ouml;/g, 'ö')
        .replace(/&auml;/g, 'ä')
        .replace(/&aring;/g, 'å')
        .replace(/&Ouml;/g, 'Ö')
        .replace(/&Auml;/g, 'Å')
        .replace(/&Aring;/g, 'Å')
    })
  },
};

function main(metadata, desklet_id) {
    return new MyDesklet(metadata, desklet_id);
}


