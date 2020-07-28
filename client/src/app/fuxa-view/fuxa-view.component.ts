import { Component, OnInit, AfterViewInit, Input, ViewContainerRef, ComponentFactoryResolver, Output, EventEmitter } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';
import { Subscription } from "rxjs";

import { Hmi, View, GaugeSettings, Event, GaugeEventActionType, GaugeStatus } from '../_models/hmi';
import { GaugesManager } from '../gauges/gauges.component';
import { isUndefined } from 'util';

declare var SVG: any;

@Component({
	selector: 'app-fuxa-view',
	templateUrl: './fuxa-view.component.html',
	styleUrls: ['./fuxa-view.component.css']
})
export class FuxaViewComponent implements OnInit, AfterViewInit {

	@Input() id: string;
	@Input() view: View;
	@Input() hmi: Hmi;
	@Input() gaugesManager: GaugesManager;        // gauges.component
	@Input() parentcards: CardModel[];

	@ViewChild('dataContainer') dataContainer: ElementRef;

	cards: CardModel[] = [];
	dialog: DialogModalModel;
    mapGaugeStatus = {};


	private subscriptionOnChange: Subscription;

	constructor(private el: ElementRef,
		private viewContainerRef: ViewContainerRef,
		private resolver: ComponentFactoryResolver) {

	}

	ngOnInit() {
		try {
		}
		catch (err) {
			console.log(err);
		}
	}

	ngAfterViewInit() {
		this.loadHmi(this.view);
		try {
			this.gaugesManager.emitBindedSignals(this.id);
		}
		catch (e) {
		}
	}

	ngOnDestroy() {
		this.gaugesManager.unbindGauge(this.id);
		this.clearGaugeStatus();
		try {
			if (this.subscriptionOnChange) {
				this.subscriptionOnChange.unsubscribe();
			}
		} catch (e) {
		}
	}

	private clearGaugeStatus() {
		Object.values(this.mapGaugeStatus).forEach((gs: GaugeStatus) => {
			try {
				if (gs.actionRef && gs.actionRef.timer) {
					clearTimeout(gs.actionRef.timer);
				}
			} catch (e) {
			}
		});
		this.mapGaugeStatus = {};
	}

	/**
	 * load the svg content to show in browser, clear all binded to this view
	 * @param view 
	 */
	public loadHmi(view: View) {
		if (this.id) {
			this.gaugesManager.unbindGauge(this.id);
			this.clearGaugeStatus();
		}
		if (view) {
			this.id = view.id;
			this.view = view;
			this.dataContainer.nativeElement.innerHTML = view.svgcontent.replace('<title>Layer 1</title>', '');;
			if (view.profile.bkcolor) {
				this.dataContainer.nativeElement.style.backgroundColor = view.profile.bkcolor;
			}
		}
		this.loadWatch(this.view);
	}

	/**
	 * load all gauge settings, bind gauge with signals, bind gauge event
	 * @param view 
	 */
	private loadWatch(view: View) {
		if (view && view.items) {
			// this.gaugesManager.initGaugesMap();
			for (let key in view.items) {
				let gauge = this.gaugesManager.initElementAdded(view.items[key], this.resolver, this.viewContainerRef, true);
				this.gaugesManager.bindGauge(gauge, this.id, view.items[key],
					(gatobindclick) => {
						this.onBindClick(gatobindclick);
					},
					(gatobindhtmlevent) => {
						this.onBindHtmlEvent(gatobindhtmlevent);
					});
			}
			let self = this;
			this.subscriptionOnChange = this.gaugesManager.onchange.subscribe(sig => {
				if (!isUndefined(sig.value)) {
					try {
						// take all gauges settings binded to the signal id in this view
						let gas = this.gaugesManager.getGaugeSettings(this.id, sig.id);
						if (gas) {
							for (let i = 0; i < gas.length; i++) {
								let gaugeSetting = gas[i];
								let gaugeStatus = this.getGaugeStatus(gaugeSetting);
								if (this.checkStatusVaue(gaugeStatus, sig)) {
									let svgeles = this.getSvgElements(gaugeSetting.id);
									for (let y = 0; y < svgeles.length; y++) {
										this.gaugesManager.processValue(gaugeSetting, svgeles[y], sig, gaugeStatus);
									}
								}
							}
						}
					} catch (err) {

					}
				}
			});
		}
	}

	/**
	 * return the mapped gauge status, if it doesn't exist add it
	 * @param gaugeId 
	 */
	private getGaugeStatus(ga: GaugeSettings) : GaugeStatus {
		if (this.mapGaugeStatus[ga.id]) {
			return this.mapGaugeStatus[ga.id];
		} else {
			this.mapGaugeStatus[ga.id] = this.gaugesManager.createGaugeStatus(ga);
			return this.mapGaugeStatus[ga.id];
		}
	}

	/**
	 * check the change of variable value in gauge status 
	 * @param gaugeStatus 
	 * @param signal 
	 */
	private checkStatusVaue(gaugeStatus: GaugeStatus, signal: any) {
		let result = true;
		if (gaugeStatus.onlyChange && gaugeStatus.variablesValue[signal.id] === signal.value) {
			result = false;
		}
		gaugeStatus.variablesValue[signal.id] = signal.value;
		return result;
	}

	private onBindClick(ga: GaugeSettings) {
		let self = this;
		let svgele = this.getSvgElement(ga.id);
		if (svgele) {
			svgele.click(function (ev) {
				let event = self.gaugesManager.getBindClick(ga);
				if (event && event.length > 0 && event[0].action && event[0].actparam) {
					let actindex = Object.keys(GaugeEventActionType).indexOf(event[0].action);
					if (Object.values(GaugeEventActionType).indexOf(GaugeEventActionType.onpage) === actindex) {
						self.loadPage(ev, event[0].actparam);
					} else if (Object.values(GaugeEventActionType).indexOf(GaugeEventActionType.onwindow) === actindex) {
						self.onOpenCard(ga.id, ev, event[0].actparam);
					} else if (Object.values(GaugeEventActionType).indexOf(GaugeEventActionType.ondialog) === actindex) {
						self.openDialog(ev, event[0].actparam);
					} else if (Object.values(GaugeEventActionType).indexOf(GaugeEventActionType.onSetValue) === actindex) {
						self.onSetValue(ga, event[0].actparam);
					}
					// self.createComponent(event[0].name, ev.x, ev.y);
				}
			});
		}
	}

	private onBindHtmlEvent(htmlevent: Event) {
		let self = this;
		// let htmlevent = this.getHtmlElement(ga.id);
		if (htmlevent.type === 'key-enter') {
			htmlevent.dom.onkeypress = function (ev) {
				if (ev.keyCode === 13) {
					console.log('click sig ' + htmlevent.dom.id + ' ' + htmlevent.dom.value);
					htmlevent.dbg = 'key pressed ' + htmlevent.dom.id + ' ' + htmlevent.dom.value;
					htmlevent.id = htmlevent.dom.id;
					htmlevent.value = htmlevent.dom.value;
					self.gaugesManager.putEvent(htmlevent);
				}
			};
		} else if (htmlevent.type === 'change') {
			htmlevent.dom.onchange = function (ev) {
				console.log('change sig ' + htmlevent.dom.id + ' ' + htmlevent.dom.value);
				htmlevent.dbg = 'key pressed ' + htmlevent.dom.id + ' ' + htmlevent.dom.value;
				htmlevent.id = htmlevent.dom.id;
				htmlevent.value = htmlevent.dom.value;
				self.gaugesManager.putEvent(htmlevent);
			};
		}
	}

	private getView(viewref: string): View {
		let view: View;
		for (let i = 0; this.hmi.views.length; i++) {
			if (this.hmi.views[i] && this.hmi.views[i].id === viewref) {
				view = this.hmi.views[i];
				break;
			}
		}
		return view;
	}

	private getSvgElements(svgid: string) {
		let ele = document.getElementsByTagName('svg');
		let result = [];
		for (let i = 0; i < ele.length; i++) {
			let svgItems = ele[i].getElementById(svgid);
			if (svgItems) {
				result.push(SVG.adopt(svgItems));
			}
		}
		return result;
	}

	private getSvgElement(svgid: string) {
		let ele = document.getElementsByTagName('svg');
		for (let i = 0; i < ele.length; i++) {
			let svgItems = ele[i].getElementById(svgid);
			if (svgItems) {
				return SVG.adopt(svgItems);
			}
		}
	}

	private loadPage(event, viewref: string) {
		let view: View = this.getView(viewref);
		if (view) {
			this.loadHmi(view);
		}
	}

	openDialog(event, viewref: string) {
		let view: View = this.getView(viewref);
		if (!view) {
			return;
		}
		this.dialog = new DialogModalModel(viewref);
		this.dialog.width = view.profile.width;
		this.dialog.height = view.profile.height + 26;
		this.dialog.view = view;
		this.dialog.bkcolor = 'trasparent';
		if (view.profile.bkcolor) {
			this.dialog.bkcolor = view.profile.bkcolor;
		}

	}

	onOpenCard(id: string, event, viewref: string) {
		let view: View = this.getView(viewref);
		if (!view) {
			return;
		}
		// check existing card
		let card = null;
		this.cards.forEach(c => {
			if (c.id === id) {
				card = c;
			}
		});
		if (card) {
			return;
		}
		card = new CardModel(id);
		card.x = event.clientX;
		card.y = event.clientY;
		card.width = view.profile.width;
		card.height = view.profile.height;
		card.view = view;
		if (this.parentcards) {
			this.parentcards.push(card);
		} else {
			this.cards.push(card);
		}
	}

	onCloseCard(card: CardModel) {
		this.cards.splice(this.cards.indexOf(card), 1);
	}

	onCloseDialog() {
		delete this.dialog;
	}

	onSetValue(ga: GaugeSettings, paramValue) {
		if (ga.property && ga.property.variableId) {
			this.gaugesManager.putSignalValue(ga.property.variableId, paramValue);
		}
	}

	getCardHeight(height) {
		return parseInt(height) + 4;
	}
}

export class CardModel {
	public id: string;
	public name: string;
	public x: number;
	public y: number;
	public width: number;
	public height: number;
	public view: View;

	constructor(id: string) {
		this.id = id;
	}
}

export class DialogModalModel {
	public id: string;
	public name: string;
	public width: number;
	public height: number;
	public bkcolor: string;
	public view: View;

	constructor(id: string) {
		this.id = id;
	}
}