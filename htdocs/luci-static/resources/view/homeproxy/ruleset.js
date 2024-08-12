/*
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2023 ImmortalWrt.org
 */

'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

'require homeproxy as hp';

function parseRulesetLink(uri) {
	var config,
		format = new RegExp(/^(json|srs)$/),
		unuciname = new RegExp(/[^a-zA-Z0-9_]+/, "g");

	uri = uri.split('://');
	if (uri[0] && uri[1]) {
		switch (uri[0]) {
		case 'http':
		case 'https':
			var url = new URL('http://' + uri[1]);
			var filename = decodeURIComponent(url.pathname.split('/').pop());
			var label = filename.replace(/[\s\.-]/g, '_').replace(unuciname, '');
			var suffix = filename.split('.').pop();

			if (format.test(suffix)) {
				config = {
					label: label ? label : null,
					type: 'remote',
					format: suffix.match(/^json$/) ? 'source' : suffix.match(/^srs$/) ? 'binary' : null,
					url: String.format('%s://%s%s%s', uri[0], url.username ? url.username + '@' : '', url.host, url.pathname),
					href: String.format('http://%s%s%s', url.username ? url.username + '@' : '', url.host, url.pathname)
				};
			}

			break;
		case 'file':
			var url = new URL('file://' + uri[1]);
			var filename = decodeURIComponent(url.pathname.split('/').pop());
			var label = filename.replace(/[\s\.-]/g, '_').replace(unuciname, '');
			var suffix = filename.split('.').pop();

			if (format.test(suffix)) {
				config = {
					label: label ? label : null,
					type: 'local',
					format: suffix.match(/^json$/) ? 'source' : suffix.match(/^srs$/) ? 'binary' : null,
					path: url.pathname,
					href: String.format('file://%s%s', url.host, url.pathname)
				};
			}

			break;
		}
	}

	if (config) {
		if (!config.type || !config.format || !config.href)
			return null;
		else if (!config.label)
			config.label = hp.calcStringMD5(config.href);
	}

	return config;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('homeproxy')
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('homeproxy', _('Edit ruleset'));

		/* Rule set settings start */
		var prefix = 'rule_';
		s = m.section(form.GridSection, 'ruleset');
		s.addremove = true;
		s.rowcolors = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = L.bind(hp.loadModalTitle, this, _('Rule set'), _('Add a rule set'), data[0]);
		s.sectiontitle = L.bind(hp.loadDefaultLabel, this, data[0]);
		/* Import rule-set links start */
		s.handleLinkImport = function() {
			var textarea = new ui.Textarea('', {
				'placeholder': 'https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-hk.srs\nfile:///etc/homeproxy/ruleset/example.json'
			});
			ui.showModal(_('Import rule-set links'), [
				E('p', _('Supports rule-set links of type: <code>local, remote</code> and format: <code>source, binary</code>.')),
				textarea.render(),
				E('div', { class: 'right' }, [
					E('button', {
						class: 'btn',
						click: ui.hideModal
					}, [ _('Cancel') ]),
					'',
					E('button', {
						class: 'btn cbi-button-action',
						click: ui.createHandlerFn(this, function() {
							var input_links = textarea.getValue().trim().split('\n');
							if (input_links && input_links[0]) {
								/* Remove duplicate lines */
								input_links = input_links.reduce((pre, cur) =>
									(!pre.includes(cur) && pre.push(cur), pre), []);

								var imported_ruleset = 0;
								input_links.forEach((l) => {
									var config = parseRulesetLink(l);
									if (config) {
										var hrefHash = hp.calcStringMD5(config.href);
										var sid = uci.add(data[0], 'ruleset', hrefHash);
										Object.keys(config).forEach((k) => {
											uci.set(data[0], sid, k, config[k]);
										});
										imported_ruleset++;
									}
								});

								if (imported_ruleset === 0)
									ui.addNotification(null, E('p', _('No valid rule-set link found.')));
								else
									ui.addNotification(null, E('p', _('Successfully imported %s rule-set of total %s.').format(
										imported_ruleset, input_links.length)));

								return uci.save()
									.then(L.bind(this.map.load, this.map))
									.then(L.bind(this.map.reset, this.map))
									.then(L.ui.hideModal)
									.catch(function() {});
							} else {
								return ui.hideModal();
							}
						})
					}, [ _('Import') ])
				])
			])
		}
		s.renderSectionAdd = function(extra_class) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
				nameEl = el.querySelector('.cbi-section-create-name');

			ui.addValidator(nameEl, 'uciname', true, (v) => {
				var button = el.querySelector('.cbi-section-create > .cbi-button-add');
				var uciconfig = this.uciconfig || this.map.config;

				if (!v) {
					button.disabled = true;
					return true;
				} else if (uci.get(uciconfig, v)) {
					button.disabled = true;
					return _('Expecting: %s').format(_('unique UCI identifier'));
				} else if (uci.get(uciconfig, prefix + v)) {
					button.disabled = true;
					return _('Expecting: %s').format(_('unique label'));
				} else {
					button.disabled = null;
					return true;
				}
			}, 'blur', 'keyup');

			el.appendChild(E('button', {
				'class': 'cbi-button cbi-button-add',
				'title': _('Import rule-set links'),
				'click': ui.createHandlerFn(this, 'handleLinkImport')
			}, [ _('Import rule-set links') ]));

			return el;
		}
		s.handleAdd = function(ev, name) {
			return form.GridSection.prototype.handleAdd.apply(this, [ ev, prefix + name ]);
		}
		/* Import rule-set links end */

		o = s.option(form.Value, 'label', _('Label'));
		o.load = L.bind(hp.loadDefaultLabel, this, data[0]);
		o.validate = L.bind(hp.validateUniqueValue, this, data[0], 'ruleset', 'label');
		o.modalonly = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = o.enabled;
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.ListValue, 'type', _('Type'));
		o.value('local', _('Local'));
		o.value('remote', _('Remote'));
		o.default = 'remote';
		o.rmempty = false;

		o = s.option(form.ListValue, 'format', _('Format'));
		o.value('source', _('Source file'));
		o.value('binary', _('Binary file'));
		o.default = 'source';
		o.rmempty = false;

		o = s.option(form.Value, 'path', _('Path'));
		o.datatype = 'file';
		o.placeholder = '/etc/homeproxy/ruleset/example.json';
		o.rmempty = false;
		o.depends('type', 'local');
		o.modalonly = true;

		o = s.option(form.Value, 'url', _('Rule set URL'));
		o.validate = function(section_id, value) {
			if (section_id) {
				if (!value)
					return _('Expecting: %s').format(_('non-empty value'));

				try {
					var url = new URL(value);
					if (!url.hostname)
						return _('Expecting: %s').format(_('valid URL'));
				}
				catch(e) {
					return _('Expecting: %s').format(_('valid URL'));
				}
			}

			return true;
		}
		o.rmempty = false;
		o.depends('type', 'remote');
		o.modalonly = true;

		o = s.option(form.ListValue, 'outbound', _('Outbound'),
			_('Tag of the outbound to download rule set.'));
		o.load = function(section_id) {
			delete this.keylist;
			delete this.vallist;

			this.value('direct-out', _('Direct'));
			uci.sections(data[0], 'routing_node', (res) => {
				if (res.enabled === '1')
					this.value(res['.name'], res.label);
			});

			return this.super('load', section_id);
		}
		o.default = 'direct-out';
		o.rmempty = false;
		//o.editable = true;
		o.depends('type', 'remote');

		o = s.option(form.Value, 'update_interval', _('Update interval'),
			_('Update interval of rule set.<br/><code>1d</code> will be used if empty.'));
		o.depends('type', 'remote');
		/* Rule set settings end */

		return m.render();
	}
});
