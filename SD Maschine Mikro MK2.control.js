/*
  =====================================================================================================

    SD Maschine Mikro Mk2.contro.js
    Created  : 11 Nov 2019 8:51:30pm
    Author   : Marcel Huibers
    Project  : Maschine Mikro Mk2 script for Bitwig 3.0+
    Company  : Sound Development
    Copyright: Marcel Huibers (c) 2019 All Rights Reserved

  =====================================================================================================
*/

loadAPI(9);

host.setShouldFailOnDeprecatedUse(true);
host.defineController("Native Instruments", "Maschine Mikro MK2", "0.1", "fff4a93d-70af-400c-bd62-356f61e8b47e", "Marcel Huibers");
host.defineMidiPorts(1, 1);

if (host.platformIsWindows()) {

    host.addDeviceNameBasedDiscoveryPair(["Maschine MK2 Virtual Input"], ["Maschine MK2 Virtual Output"]);
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 Controller"], ["Maschine Mikro MK2 Controller"]);
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 Virtual Input"], ["Maschine Mikro MK2 Virtual Output"]);
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 In"], ["Maschine Mikro MK2 Out"]);

}
else if (host.platformIsMac()) {
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 Controller"], ["Maschine Mikro MK2 Controller"]);
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 Virtual Input"], ["Maschine Mikro MK2 Virtual Output"]);
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 In"], ["Maschine Mikro MK2 Out"]);

}
else if (host.platformIsLinux()) {
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 Controller"], ["Maschine Mikro MK2 Controller"]);
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 Virtual Input"], ["Maschine Mikro MK2 Virtual Output"]);
    host.addDeviceNameBasedDiscoveryPair(["Maschine Mikro MK2 In"], ["Maschine Mikro MK2 Out"]);

}


var CC =
{
    CONTROL: 91,
    CONTROL1: 92,
    CONTROL2: 93,
    CONTROL3: 94,
    ENTER: 95,
    STOPTRACK: 96,
    FULLSCREEN: 97,
    CLICK: 98,
    POSITION: 99,
    SELECT: 100,
    VIEW: 101,
    PANEL: 102,
    TAP: 103,
    REDO: 104,
    INSPECT: 105,
    PATTERN: 106,
    CUT: 107,
    COPY: 108,
    PASTE: 109,
    PREV_TRACK: 110,
    NEXT_TRACK: 111,
    LOOP: 113,
    REWIND: 114,
    FORWARD: 115,
    STOP: 116,
    PLAY: 117,
    RECORD: 118,
    SOLO: 119,
    MUTE: 120,
    DUPLICATE: 121,
    BROWSE: 122,
    ZOOM: 123,
    FIT: 124,
    SELECTION: 125,
    DELETE: 126,
    UNDO: 127,
    SLIDER: 7,
};

var HIGHEST_CC = CC.CONTROL - 1;
var LOWEST_CC = HIGHEST_CC - 3;;


function init() {

    padColor = 4;
    previousZoom = 0;
    previousPosition = 0;
    previousVolume = 0;
    previousView = 0;
    previousController = 0;
    controllerToSend = 0;
    selectionToggle = 0;

    pads = host.getMidiInPort(0).createNoteInput("SD MMMK2", "80????", "90????");
    //pads = host.getMidiInPort(0).createNoteInput("Maschine Mikro Mk2", "?0????");
    pads.setShouldConsumeEvents(false);
    host.getMidiInPort(0).setMidiCallback(onMidi0);
    host.getMidiInPort(0).setSysexCallback(onSysex0);

    transport = host.createTransport();
    hostApp = host.createApplication();
    userControls = host.createUserControls(HIGHEST_CC);
    cursorTrack = host.createCursorTrack(4, 4); // The cursor track view follows the track selection in the application GUI.

    notif = host.getNotificationSettings();

    notif.setShouldShowChannelSelectionNotifications(true);
    notif.setShouldShowDeviceLayerSelectionNotifications(true);
    notif.setShouldShowDeviceSelectionNotifications(true);
    notif.setShouldShowMappingNotifications(true);
    notif.setShouldShowPresetNotifications(true);
    notif.setShouldShowSelectionNotifications(true);
    notif.setShouldShowTrackSelectionNotifications(true);
    notif.setShouldShowValueNotifications(true);

    // Make CCs freely mappable
    for (var i = LOWEST_CC; i <= HIGHEST_CC; i++) {
        userControls.getControl(i - LOWEST_CC).setLabel("CC" + i);
    }

    // Add value observers for bi-directional communication.
    transport.isPlaying().addValueObserver(function (value) {
        sendChannelController(0, CC.PLAY, value ? 127 : 0);
        sendChannelController(0, CC.STOP, value ? 0 : 127);
    });
    transport.isArrangerLoopEnabled().addValueObserver(function (value) {
        sendChannelController(0, CC.LOOP, value ? 127 : 0);
    });
    transport.isArrangerRecordEnabled().addValueObserver(function (value) {
        sendChannelController(0, CC.RECORD, value ? 127 : 0);
    });
    cursorTrack.solo().addValueObserver(function (value) {
        sendChannelController(0, CC.SOLO, value ? 127 : 0);
    });
    cursorTrack.mute().addValueObserver(function (value) {
        sendChannelController(0, CC.MUTE, value ? 127 : 0);
    });
    transport.isMetronomeEnabled().addValueObserver(function (value) {
        sendChannelController(0, CC.CLICK, value ? 127 : 0);
    });
    sendChannelController(0, CC.STOPTRACK, 0);
    cursorTrack.isStopped().addValueObserver(function (value) {
        sendChannelController(0, CC.STOPTRACK, value ? 0 : 127);
    });
    cursorTrack.addNoteObserver(function (enabled, key, velocity) {
        if (enabled) { sendMidi(144, key, 4 + (velocity * 23)); }
        else { sendMidi(128, key, 4 + (velocity * 23)); }
    });
    hostApp.panelLayout().addValueObserver(function (value) {
        if (value == "ARRANGE") {
            transport.returnToArrangement();
        }
    });

    clearPads();
    updateControlSelectors();
    lightPads(127);

    println("SD MKKK2 initialized succsesfully.");
}

// Called when a short MIDI message is received on MIDI input port 0.
function onMidi0(status, data1, data2) {

    // printMidi(status, data1, data2);

    if (isChannelController(status)) {
        if (data1 == CC.RECORD) {
            if (data2 > 0) {
                cursorTrack.arm().set(true);
                transport.record();
            }
            else {
                cursorTrack.arm().set(false);
                transport.stop();
            }
        }

        if (data1 == CC.SELECT) {
            if (data2 > 0) {
                hostApp.selectAll();
            }
            else {
                hostApp.selectNone();
            }
        }

        if (data1 == CC.PANEL) {
            switch (previousView) {
                case 0:
                    hostApp.setPanelLayout("ARRANGE");
                    break;
                case 1:
                    hostApp.setPanelLayout("MIX");
                    break;
                case 2:
                    hostApp.setPanelLayout("EDIT");
                    break;
                case 3:
                    hostApp.setPanelLayout("ARRANGE");
                    previousView = 0;
                    break;
            }
            previousView++;
        }

        if (data1 == CC.ZOOM) {
            if (data2 > previousZoom) {
                hostApp.zoomIn();
            }
            else {
                hostApp.zoomOut();
            }
            previousZoom = data2;
        }

        if (data1 == CC.POSITION) {
            if (data2 > previousPosition) {
                transport.incPosition(1.0, true);
            }
            else {
                transport.incPosition(-1.0, true);
            }
            previousPosition = data2;
        }

        if (data1 >= CC.CONTROL1 && data1 <= CC.UNDO && data1 != 112 && data2 > 0) {
            switch (data1) {
                case CC.PREV_TRACK:
                    cursorTrack.selectPrevious();
                    cursorTrack.makeVisibleInMixer();
                    cursorTrack.makeVisibleInArranger();
                    clearPads();
                    break;
                case CC.NEXT_TRACK:
                    cursorTrack.selectNext();
                    cursorTrack.makeVisibleInMixer();
                    cursorTrack.makeVisibleInArranger();
                    clearPads();
                    break;
                case CC.REWIND:
                    transport.rewind();
                    break;
                case CC.FORWARD:
                    transport.fastForward();
                    break;
                case CC.SOLO:
                    cursorTrack.solo().toggle();
                    break;
                case CC.MUTE:
                    cursorTrack.mute().toggle();
                    break;
                case CC.DUPLICATE:
                    cursorTrack.duplicate();
                    break;
                case CC.BROWSE:
                    hostApp.toggleBrowserVisibility();
                    break;
                case CC.FIT:
                    hostApp.zoomToFit();
                    break;
                case CC.SELECTION:
                    hostApp.zoomToSelection();
                    break;
                case CC.DELETE:
                    host.showPopupNotification("Delete");
                    hostApp.remove();
                    break;
                case CC.UNDO:
                    host.showPopupNotification("Undo");
                    hostApp.undo();
                    break;
                case CC.REDO:
                    host.showPopupNotification("Redo");
                    hostApp.redo();
                    break;
                case CC.VIEW:
                    hostApp.nextSubPanel();
                    break;
                case CC.TAP:
                    transport.tapTempo();
                    break;
                case CC.INSPECT:
                    hostApp.toggleInspector();
                    break;
                case CC.PATTERN:
                    hostApp.toggleNoteEditor();
                    break;
                case CC.ENTER:
                    hostApp.enter();
                    host.showPopupNotification("Enter");
                    break;
                case CC.CUT:
                    hostApp.cut();
                    host.showPopupNotification("Cut");
                    break;
                case CC.COPY:
                    hostApp.copy();
                    host.showPopupNotification("Copy");
                    break;
                case CC.PASTE:
                    hostApp.paste();
                    host.showPopupNotification("Paste");
                    break;
                case CC.STOP:
                    transport.stop();
                    break;
                case CC.PLAY:
                    transport.togglePlay();
                    break;
                case CC.LOOP:
                    host.showPopupNotification("Toggle Loop On/Off");
                    transport.isArrangerLoopEnabled().toggle();
                    break;
                case CC.CLICK:
                    host.showPopupNotification("Toggle Metronome On/Off");
                    transport.isMetronomeEnabled().toggle();
                    break;
                case CC.FULLSCREEN:
                    hostApp.toggleFullScreen();
                    host.showPopupNotification("Full Screen");
                    break;
                case CC.STOPTRACK:
                    host.showPopupNotification("Stop Track");
                    cursorTrack.stop();
                    break;
                case CC.CONTROL1:
                    controllerToSend = 0;
                    host.showPopupNotification("Control 1 Selected");
                    updateControlSelectors();
                    break;
                case CC.CONTROL2:
                    controllerToSend = 1;
                    host.showPopupNotification("Control 2 Selected");
                    updateControlSelectors();
                    break;
                case CC.CONTROL3:
                    controllerToSend = 2;
                    host.showPopupNotification("Control 3 Selected");
                    updateControlSelectors();
                    break;
            }
        }
        else if (data1 == CC.SLIDER) {
            currentVolume = cursorTrack.volume().value().inc(previousVolume > data2 ? -1 : 1, 128);
            previousVolume = data2;
        }
        else if (data1 == CC.CONTROL) {
            userControls.getControl(controllerToSend).inc(previousController > data2 ? -1 : 1, 128);
            previousController = data2;
        }
    }
}

function updateControlSelectors() {
    sendChannelController(0, CC.CONTROL1, controllerToSend == 0 ? 127 : 0);
    sendChannelController(0, CC.CONTROL2, controllerToSend == 1 ? 127 : 0);
    sendChannelController(0, CC.CONTROL3, controllerToSend == 2 ? 127 : 0);
}



function clearPads() {
    for (var i = 0; i <= 127; i++) {
        sendMidi(128, i, 127);
    }
}

function lightPads(color) {
    for (var i = 0; i <= 127; i+=2) {
        sendMidi(144, i, color);
    }
    for (var i = 1; i <= 127; i += 2) {
        sendMidi(144, i, 127-color);
    }
    host.scheduleTask(setStopTimer, 50);
}


function setStopTimer() {
    if (padColor < 127) {
        lightPads(padColor);
        padColor += 4;
    }
    else {
        clearPads();
    } 
}

// Called when a MIDI sysex message is received on MIDI input port 0.
function onSysex0(data) {
    // MMC Transport Controls:
    switch (data) {
        case "f07f7f0605f7":
            transport.rewind();
            break;
        case "f07f7f0604f7":
            transport.fastForward();
            break;
        case "f07f7f0601f7":
            transport.stop();
            break;
        case "f07f7f0602f7":
            transport.play();
            break;
        case "f07f7f0606f7":
            transport.record();
            break;
    }
}

function exit() {

}