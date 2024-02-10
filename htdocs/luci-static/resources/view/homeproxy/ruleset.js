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
		var prefmt = { 'prefix': 'rule_', 'suffix': '' };
		s = m.section(form.GridSection, 'ruleset');
		s.addremove = true;
		s.rowcolors = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = L.bind(hp.loadModalTitle, this, _('Rule set'), _('Add a rule set'), data[0]);
		s.sectiontitle = L.bind(hp.loadDefaultLabel, this, data[0]);
		s.renderSectionAdd = L.bind(hp.renderSectionAdd, this, s, prefmt);
		s.handleAdd = L.bind(hp.handleAdd, this, s, prefmt);

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
