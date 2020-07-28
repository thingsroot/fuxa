import { Component, Inject, OnInit, Input, AfterViewInit } from '@angular/core';
import { GaugeBaseComponent } from '../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, GaugeStatus } from '../../_models/hmi';
import { GaugeDialogType } from '../gauge-property/gauge-property.component';

declare var Raphael: any;

@Component({
	selector: 'gauge-switch',
	templateUrl: './switch.component.html',
	styleUrls: ['./switch.component.css']
})
export class SwitchComponent extends GaugeBaseComponent implements AfterViewInit {

	@Input() settings: GaugeSettings;
	@Input() signals: any;

	static TypeTag = 'svg-ext-switch';
	static LabelTag = 'Switch';

	constructor() {
		super();
	}

	ngOnInit() {
		if (!this.settings.property) {
			this.settings.property = new SwitchProperty();
		}
		// let property = JSON.stringify(this.settings.property);
		// this.settings.id = '';
	}

	ngAfterViewInit() {
	}

	static getSignals(pro: any) {
		let res: string[] = [];
		if (pro.signalid) {
			res.push(pro.signalid);
		}
		return res;
	}

	static getDialogType(): GaugeDialogType {
		return GaugeDialogType.OnlyValue;
	}

	static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
		if (svgele.node && svgele.node.children) {
			let toanimate: string;
			for (let i = 0; i < svgele.node.children.length; i++) {
				let node = svgele.node.children[i];
				if (node.id.indexOf('X') >= 0) {
					toanimate = node.id.substring(node.id.indexOf('X'));
				}
			}
			if (toanimate) {
				let svggsuge = svgele.select('#' + toanimate);
				var path = document.getElementById(toanimate);
				//var pos = path.getBoundingClientRect();
				var pathString = path.getAttribute('d');
				var dims = Raphael.pathBBox(pathString);
				// yourTriangle.animate({transform: "r60" + "," + centerX + "," + centerY}, 2000);
				let rotation = 34;
				if (parseInt(sig.value, 10) === 0) {
					rotation = 0;
				}
				svggsuge.animate(500).rotate(rotation, dims.x2, dims.y2);
			}
		}
	}
}

export class SwitchProperty {
	signalid: string = '';
	onmin: number = 1;
	onmax: number = 1;
}