'use strict';

const {Gio, GLib} = imports.gi;

const Mock = imports.fixtures.utils;
const Core = imports.service.core;


const Packets = {
    goodBattery: {
        type: 'kdeconnect.battery',
        body: {
            currentCharge: 50,
            isCharging: false,
            thresholdEvent: 0,
        },
    },
    lowBattery: {
        type: 'kdeconnect.battery',
        body: {
            currentCharge: 15,
            isCharging: false,
            thresholdEvent: 1,
        },
    },
    fullBattery: {
        type: 'kdeconnect.battery',
        body: {
            currentCharge: 100,
            isCharging: true,
            thresholdEvent: 0,
        },
    },
};


describe('The battery plugin', function () {
    let testRig;
    let localPlugin, remotePlugin;

    beforeAll(async function () {
        Mock.mockComponents();

        testRig = new Mock.TestRig();
        await testRig.prepare({
            localDevice: {
                incomingCapabilities: [
                    'kdeconnect.battery',
                    'kdeconnect.battery.request',
                ],
                outgoingCapabilities: [
                    'kdeconnect.battery',
                    'kdeconnect.battery.request',
                ],
            },
            remoteDevice: {
                incomingCapabilities: [
                    'kdeconnect.battery',
                    'kdeconnect.battery.request',
                ],
                outgoingCapabilities: [
                    'kdeconnect.battery',
                    'kdeconnect.battery.request',
                ],
            },
        });
        testRig.setPaired(true);
    });

    afterAll(function () {
        testRig.destroy();
    });

    beforeEach(function () {
        if (localPlugin && remotePlugin) {
            spyOn(remotePlugin, 'handlePacket').and.callThrough();
            spyOn(remotePlugin, '_receiveState').and.callThrough();
            spyOn(remotePlugin, '_requestState').and.callThrough();
            spyOn(remotePlugin, '_sendState').and.callThrough();

            spyOn(remotePlugin.device, 'showNotification');
            spyOn(remotePlugin.device, 'hideNotification');
        }
    });

    it('can be loaded', async function () {
        await testRig.loadPlugins();

        localPlugin = testRig.localDevice._plugins.get('battery');
        remotePlugin = testRig.remoteDevice._plugins.get('battery');

        expect(localPlugin).toBeDefined();
        expect(remotePlugin).toBeDefined();
    });

    it('sends and requests state updates when connected', async function () {
        testRig.setConnected(true);

        await remotePlugin.awaitPacket('kdeconnect.battery.request');
        expect(remotePlugin._requestState).toHaveBeenCalled();
        expect(remotePlugin._sendState).toHaveBeenCalled();
    });

    it('can receive state updates', async function () {
        localPlugin.device.sendPacket(Packets.goodBattery);

        await remotePlugin.awaitPacket('kdeconnect.battery',
            Packets.goodBattery.body);
        expect(remotePlugin._receiveState).toHaveBeenCalled();
    });

    it('updates properties', function () {
        expect(remotePlugin.charging).toBe(false);
        expect(remotePlugin.icon_name).toBe('battery-good-symbolic');
        expect(remotePlugin.level).toBe(50);
        expect(remotePlugin.time).toBeGreaterThan(0);
    });

    it('updates the GAction state', function () {
        let batteryAction = remotePlugin.device.lookup_action('battery');
        let [charging, icon, level, time] = batteryAction.state.deepUnpack();

        expect(charging).toBe(false);
        expect(icon).toBe('battery-good-symbolic');
        expect(level).toBe(50);
        expect(time).toBeGreaterThan(0);
    });

    it('notifies when the battery is low', async function () {
        localPlugin.device.sendPacket(Packets.lowBattery);

        await remotePlugin.awaitPacket('kdeconnect.battery',
            Packets.lowBattery.body);
        expect(remotePlugin.device.showNotification).toHaveBeenCalled();
    });

    it('withdraws low battery notifications', async function () {
        localPlugin.device.sendPacket(Packets.goodBattery);

        await remotePlugin.awaitPacket('kdeconnect.battery',
            Packets.goodBattery.body);
        expect(remotePlugin.device.hideNotification).toHaveBeenCalled();
    });

    it('notifies when the battery is full', async function () {
        remotePlugin.settings.set_boolean('full-battery-notification', true);
        localPlugin.device.sendPacket(Packets.fullBattery,
            Packets.fullBattery.body);

        await remotePlugin.awaitPacket('kdeconnect.battery');
        expect(remotePlugin.device.showNotification).toHaveBeenCalled();
    });

    it('withdraws full battery notifications', async function () {
        localPlugin.device.sendPacket(Packets.goodBattery);

        await remotePlugin.awaitPacket('kdeconnect.battery',
            Packets.goodBattery.body);
        expect(remotePlugin.device.hideNotification).toHaveBeenCalled();
    });
});

