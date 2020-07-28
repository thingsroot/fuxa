import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { Subscription } from "rxjs";

import { DeviceListComponent } from './device-list/device-list.component';
import { DeviceMapComponent } from './device-map/device-map.component';
import { Device } from './../_models/device';
import { ProjectService } from '../_services/project.service';
import { HmiService } from '../_services/hmi.service';

@Component({
	selector: 'app-device',
	templateUrl: './device.component.html',
	styleUrls: ['./device.component.css']
})
export class DeviceComponent implements OnInit, OnDestroy, AfterViewInit {

	@ViewChild('devicelist') deviceList: DeviceListComponent;
	@ViewChild('devicemap') deviceMap: DeviceMapComponent;

	private subscriptionLoad: Subscription;
	private subscriptionDeviceChange: Subscription;
	private subscriptionVariableChange: Subscription;
    private subscriptionSave: Subscription;

	showMode: string = 'map';

	constructor(private projectService: ProjectService,
		private hmiService: HmiService) { }

	ngOnInit() {
		this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
			this.deviceMap.loadCurrentProject();
			// this.deviceList.loadCurrentProject();
		});
		this.subscriptionDeviceChange = this.hmiService.onDeviceChanged.subscribe(event => {
			this.deviceMap.setDeviceStatus(event);
		});
		this.subscriptionVariableChange = this.hmiService.onVariableChanged.subscribe(event => {
			this.deviceList.updateDeviceValue();
		});
		this.subscriptionSave = this.projectService.onSaveCurrent.subscribe(saveas => {
			if (saveas) {
				this.projectService.saveAs();
			}
		});
		this.hmiService.askDeviceStatus();
	}

	ngAfterViewInit() {
		this.showMode = 'map';
	}

	ngOnDestroy() {
		// this.checkToSave();
		try {
			if (this.subscriptionLoad) {
				this.subscriptionLoad.unsubscribe();
			}
			if (this.subscriptionDeviceChange) {
				this.subscriptionDeviceChange.unsubscribe();
			}
			if (this.subscriptionVariableChange) {
				this.subscriptionVariableChange.unsubscribe();
			}
            if (this.subscriptionSave) {
                this.subscriptionSave.unsubscribe();
            }			
		} catch (e) {
		}
	}

	show(mode: string) {
		// this.checkToSave();
		this.showMode = mode;
		if (this.showMode === 'tags') {
			this.deviceList.updateDeviceValue();
			try {
				if (Object.values(this.deviceMap.devicesValue()).length > 0) {
					this.deviceList.setSelectedDevice(this.deviceMap.devicesValue()[0]);
				}
			} catch (e) {
			}
		}
	}

	gotoMap() {
		this.show('map');
	}

	gotoList(device: Device) {
		this.show('tags');
		this.deviceList.setSelectedDevice(device);
	}
}
