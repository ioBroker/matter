![Logo](admin/matter.png)
# ioBroker Matter Adapter

![Number of Installations](http://iobroker.live/badges/matter-installed.svg)
![Number of Installations](http://iobroker.live/badges/matter-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.matter.svg)](https://www.npmjs.com/package/iobroker.matter)

![Test and Release](https://github.com/ioBroker/ioBroker.matter/workflows/Test%20and%20Release/badge.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/matter/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.matter.svg)](https://www.npmjs.com/package/iobroker.matter)

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.**
For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)!
Sentry reporting is used starting with js-controller 3.0.

> [!IMPORTANT]  
> This adapter can only be installed from npm. A GitHub installation is not possible!
> For more important information please read the [Important Information](#important-information-read-first) section!

## Description
TODO

## Important Information (READ FIRST!)
* **Not installable via GitHub**: This adapter can only be installed via npm.
* **Never delete partial matter instance objects or object trees!** The configuration for this adapter is **not** contained in just one central object like in other ore simple adapters. This means that deleting instance objects or object trees can lead to a broken configuration, and you might need to reconfigure the adapter from scratch.
* **Never reinstall the adapter by deleting the instance** if you want to keep paired devices (e.g., on Controller) or paired Controllers (e.g., on Bridges). If you delete the instance all paired devices will be deleted, and you need to pair them again.
* **Use an ioBroker Backup to back up the configuration** and restore the backup to restore it. If really needed without a backup then export the whole object tree of the adapter instance (e.g., `matter.0`) and import it back if needed. These can be a high number of objects depending on the number of devices and controllers you have paired.
* Some objects are not shown by default because they are irrelevant for normal operation. If you need to see them, you can enable the "Expert Mode" in the adapter settings. This mainly is about the "storage" objects. Please **do not** change them unless you really, really know what you are doing!

## Prerequisites to use this adapter

### Used adapters and apps
If you want to use the iobroker Visu App for device pairing you need:
* ioBroker Visu App at least v1.3.1
* iot Adapter at least v3.4.4

### General prerequisites
* One instance of the adapter is bound to one host (aka IP). Multiple instances require a multi-host setup.
* Make sure IPv6 is enabled in your network and the host you use this adapter on has an IPv6 address
  * If you use LXC containers in Proxmox, this is like **not** given because Proxmox hosts are normally not configured for IPv6! A solution you can try is described in the [Wiki](https://github.com/ioBroker/ioBroker.matter/wiki/Troubleshooting)
* Make sure that UDP packages can flow between the devices, your mobile app, the hubs and the host you use this adapter on!
  * Mainly make sure to **not** use VLANs, because UDP is usually not routed between VLANs! Or find out how to configure your router to allow this (Fritz Box! does not work with this!)
  * If you use Docker containers, make sure to use **Host Mode** to allow UDP packages to flow between the containers and the host. Bridged network mode does not work with UDP packages!

### Prerequisites to Expose ioBroker devices as Matter Bridges or Devices
Important: In order to expose more than 5 Bridged devices or to expose additional separate Devices or Bridges, you need to have a Matter Pro Account with an active Assistant or Remote Control License and enter this into the adapter configuration! Please support our team with the efforts we invest in Matter with this. Controller usage is not limited by this.

* The Bridges and devices that the ioBroker Adapter exposes are not officially certified by the Matter organization. This means they only work in Ecosystems that allow this.
  * For Google additional steps might be needed - see https://github.com/project-chip/matter.js/blob/main/docs/ECOSYSTEMS.md#google-home-ecosystem
  * **Aqara Hub M3** and **Yandex** are currently (as of November 2024) not allow "uncertified devices" to be paired!
* Each Ecosystem has different limits about devices per Bridge and such. So if a high number of devices (there are test results up to 64 which should work at least in Apple, Google and - a bit wonky - Amazon) one bridge makes issues. please try splitting it up to multiple bridges. I would also be happy to find out the practical limits, so please report your experiences.
* For Alexa, currently, only the "Default Bridge" can be used on a host. Multiple Bridges to use with Alexa are only possible on different hosts.

### Prerequisites to use Matter devices in ioBroker (aka "Matter Controller")
* If you plan to use Thread-based devices (check the package for information), you need to have a Thread Border Router (TBR) in your network. Check https://github.com/project-chip/matter.js/blob/main/docs/ECOSYSTEMS.md for more information about the ecosystems and their Thread support. More information on Thread and also on how to add an own TBR can be found at https://github.com/project-chip/matter.js/blob/main/docs/USAGE_THREAD.md
* If you run on Linux and plan to use Thread-based devices and have issues connecting to them, please refer to https://github.com/project-chip/matter.js/blob/main/docs/TROUBLESHOOTING.md#ipv6-linux-system-details for instructions how to tweak the IPv6 configuration on your Linux system.
* Initial commissioning of devices is possible with the "ioBroker Visu App" which uses the BLE of your mobile device and is the most convenient way. You can also use the BLE of your ioBroker host, but then the device also needs to be in BLE range of your host. When using the App you need an ioBroker Pro Account with an active Assistant or Remote Control License.

## Supported devices

### Supported ioBroker device types

| ioBroker Device Type | Mapped to Matter Device Type | Comments                                                                                                                            |
|----------------------|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Button               | GenericSwitch                | Reports multi-presses when the time between single presses is maximum 300ms.                                                        |
| ButtonSensor         | GenericSwitch                | Reports multi-presses when the time between single presses is maximum 300ms. Reports Long-presses when the PRESS_LONG state is used |
| Ct                   | Color Temperature Light      |                                                                                                                                     |
| Dimmer               | Dimmable Light               |                                                                                                                                     |
| Door                 | Contact Sensor               |                                                                                                                                     |
| Flood Alarm          | Water Leak Detector          |                                                                                                                                     |
| Humidity             | Humidity Sensor              |                                                                                                                                     |
| Illuminance          | Illuminance Sensor           |                                                                                                                                     |
| Light                | OnOff Light                  |                                                                                                                                     |
| Lock                 | Door Lock                    |                                                                                                                                     |
| Motion               | Occupancy Sensor             |                                                                                                                                     |
| Socket               | OnOff PlugIn                 |                                                                                                                                     |
| Temperature          | Temperature Sensor           |                                                                                                                                     |
| Window               | Contact Sensor               |                                                                                                                                     |

... more to come

### Supported Matter device types

| Matter Device Type                   | Mapped to ioBroker Device Type                    |
|--------------------------------------|---------------------------------------------------|
| Color Temperature Light              | Ct                                                |
| Contact Sensor                       | Window                                            |
| Dimmable Light                       | Dimmer                                            |
| Dimmable PlugIn Unit                 | Dimmer                                            |
| Door Lock                            | Lock                                              |
| Energy Sensor                        | Light with only energy states                     |
| Extended Color Light                 | Hue or Cie based on supported features            |
| Generic Switch (as Latching Switch)  | Socket (state ACTUAL only)                        |
| Generic Switch (as Momentary Switch) | ButtonSensor                                      |
| Humidity Sensor                      | Humidity                                          |
| Illuminance Sensor                   | Illuminance                                       |
| Occupancy Sensor                     | Motion                                            |
| OnOff Light                          | Light                                             |
| OnOff PlugIn Unit                    | Socket                                            |
| Speaker                              | Volume                                            |
| Temperature Sensor                   | Temperature                                       |
| Thermostat                           | Thermostat                                        |
| Water Leak Detector                  | Flood Alarm                                       |
| Window Covering                      | Blind or BlindButtons based on supported features |

... more to come

## Usage information
TBD

### Wording: Node vs Device
TBD

### Using the Matter Controller
TBD

#### Pairing nodes
TBD

#### Overview of the nodes and devices (UI)
TBD

#### Overview of the devices (Objects)
TBD

#### Using the devices (ioBroker Device compatible states)
This is the default mode for all supported device types where ioBroker has a matching own device type.
In this case, the functionality is conveniently abstracted as defined in ioBroker and how it is mapped for many other adapter states.
The exposed functionality is limited to what ioBroker defines for the device type and should allow all normal operations.

If you need more granularity and access to device-specific functionality or settings, you can enable the "Application Cluster states" for this node or device to gain access (see below).

#### Using the Application Cluster states (needs to be enabled!)
Note: This is considered Advanced Usage!

Sometimes it might be handy to also see more internal details of the device or to access more specific functionality of the device.
In this case, you can enable the "Application Cluster states" for the node or device.
This, e.g., allows setting the sensitivity for a motion sensor.
When enabled for a node (valid then for all devices exposed by the node) or a device, you will see a lot of additional states in an object's folder `data`. 

The details are structured by the application cluster and separated in attributes (data states) and commands.
The exact meaning, units and allowed values and ranges for the data can be taken from the Matter Application Specification document.
When commands are exposed as a "button" then the action can be triggered by just setting a boolean value to the state.
But most commands require more data (these are "json" strings) and require that a JSON string with all command fields are provided.
The exact definition of the command fields can be taken from the Matter Application Specification document.

#### Using the System Cluster states (needs to be enabled!)
Note: This is considered Professional Usage!

In all normal end user cases, you should not need to use the System Cluster states.
They are only needed for special cases and for debugging or to deeply explore the Matter cluster data.
If you enable them, you will see a lot of additional states that are not needed for normal operation.
Any changes to the writable states can break the functionality of the devices.
So please only use them if you know what you are doing!

### Using the Matter Bridges

#### Recommendations
* Not all ecosystems support all device types, and sometimes ecosystems react strangely when you add a device type they do not support. So please check the ecosystem documentation for the supported device types, if available or try it out. We try to collect the details in the [Supported ioBroker devices](#supported-iobroker-device-types) section. Please report any new information as an issue or PR.
* If you plan to use bridges with many devices, so please consider commissioning the bridge initially with just some added devices and then add more overtime. This can help to avoid issues with the ecosystems and also could be a better experience for you. 

### Using the Matter Devices
TBD

## Troubleshooting
* On Linux especially see https://github.com/project-chip/matter.js/blob/main/docs/TROUBLESHOOTING.md

### Troubleshooting for Devices and Bridges
* With Alexa only the Default bridge can be used on a host. Multiple Bridges to use with Alexa are only possible on different hosts.
* When an Ecosystem shows the device as disconnected, especially after an adapter restart, then this usually means that the controller has not yet reconnected to the device. This can take some time. If it does not reconnect after a few minutes, then please check the connection information in the UI. If an ecosystem is not connecting at all, please check logs and potentially debug logs and open an issue.

### Troubleshooting for the Controller


## How to report issues
* Please check [Prerequisites to use this adapter](#prerequisites-to-use-this-adapter) and [Troubleshooting](#troubleshooting) first
* Check that you are using the latest version available - or if not, if the changelog for the versions since your version contains information about your issue. Then try updating first, please.
* Check existing open GitHub issues. If yours is also listed, there vote for it by adding a thumbs up on the first comment. This helps to prioritize the issues. "Me Too" posts are not needed.
* Create a GitHub issue if your issue is not existing
* Turn on Debug logs for the matter instance, and additionally "Matter Debug" logs on the main page of the adapter settings. Include the logs (as a Text file please, Logfile location usually `/opt/iobroker/logs/...`) as text file attachment in your issue report. Please do not cut only the error but also add some minutes of log before and after the error to get some more context. Please also include information on what exactly is seen there, what was done and such. The more context you can provide, the better.


## ToDo
* Texts are partially in english
* Sync min/max from Matter into ioBroker objects
* Cleanup objects when devices/states are removed
* ioBroker device types
  * (9) Lights:
    * rgb
    * rgbwSingle
    * rgbSingle
    * cie
    * hue
  * (8) blinds + blindButtons
  * (-8) thermostat
  * (3+) vacuumCleaner
  * (3) volume, volumeGroup
  * (-3) airCondition
  * (2+) fireAlarm
  * (-2) mediaPlayer
  * warning - how?
  * gate - aka blinds?
  * windowTilt - how?
  * levelSlider - how?
* Matter device types
  * (7) Fan -> thermostat?
  * (4+) Air Quality Sensor -> ???
  * (4+) Air Purifier -> ???
  * (4) Pump -> ???
  * (4) Pressure Sensor -> ??? DEF
  * (3+) Robot Vacuum cleaner -> vacuumCleaner
  * (3) Flow Sensor -> ??? DEF
  * (3) Room Air Conditioner -> airCondition
  * (2+) Smoke & CO Alarm -> fireAlarm? warning? 
  * (2+) Dishwasher-> ???
  * (2) Basic Video Player -> mediaPlayer
  * (2) Laundry Washer -> ???
  * (2) Refrigerator -> ???
  * (2) Temperature Controlled Cabinet -> ???
  * (2) Water Freeze Detector -> warning?
  * (2) Rain Sensor -> warning?
  * (2) Water Valve -> ???
  * (2) Laundry Dryer -> ???
  * (2) Oven -> ???
  * (2) Cooktop -> ???
  * (2) Cook Surface -> ???
  * (2) Extractor Hood -> ???
  * (2) Microwave Oven -> ???
  * (1+) Electrical Vehicle Supply Equipment -> ???
  * (0) Water Heater -> ???
  * (0) Solar Power -> ???
  * (0) Battery Storage -> ???
  * (0) Heat Pump -> ???

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

## Changelog
### **WORK IN PROGRESS**
* (@GermanBluefox) Showed the device name in paring dialog
* (@GermanBluefox/Apollon77) Adjusts connection type icons
* (@Apollon77) Optimized the discovery dialog handling
* (@Apollon77) Fixed Thermostat for Controller to update temperatures
* (@Apollon77) Gives Energy sensors a dedicated icon
* (@Apollon77) Optimized an fixed multiple things

### 0.3.6 (2025-01-13)
* (@GermanBluefox) Fixed GUI errors
* (@GermanBluefox/@Apollon77) Added possibility to enable/disable controlled nodes
* (@Apollon77) Added Information on battery and rssi for DM tile
* (@Apollon77) Added controller support for Color Lights, Speaker, Thermostats and Window coverings
* (@Apollon77) Optimized an fixed multiple things

### 0.3.5 (2025-01-09)
* (@GermanBluefox) Fixed GUI errors
* (@GermanBluefox) Added `Controller fabric label` to configuration
* (@GermanBluefox) Added solution for QR-Code scanning on non HTTPS pages
* (@Apollon77) Fixed Generic Switch Device type for controller
* (@Apollon77) Fixed Controller BLE initialization and activation
* (@Apollon77) Added serialNumber to all devices and bridges for better device re-detection by controllers

### 0.3.4 (2024-12-31)
* (@Apollon77) Updates matter.js to address several issues
* (@bluefox) Optimized UI

### 0.3.3 (2024-12-28)
* (@Apollon77) Allows triggering commands via matter also when the state already matches the value
* (@Apollon77) Sets and updates the fabric label for paired devices (default is "ioBroker matter.X")
* (@Apollon77) Detects state deletion for ioBroker devices and updates a device in UI to show device state
* (@Apollon77) Several optimizations on commissioning
* (@Apollon77) Do not show commissioning QR codes in ioBroker log
* (@Apollon77) Use Fabric label to try to detect if ioBroker is the controller
* (@Apollon77) Fixes displaying error details for devices and bridges
* (@Apollon77) Fixes the device and type detection logic

### 0.3.2 (2024-12-21)
* (@Apollon77) Fixes several discovery issues

### 0.3.1 (2024-12-20)
* (@Apollon77) Fixes bridge/device icon display in UI
* (@Apollon77) Prevents displaying warning dialogs when nothing is wrong
* (@Apollon77) Adjusts some logs

### 0.3.0 (2024-12-20)
* BREAKING: Please re-enter your ioBroker Pro Cloud Password!
* (@Apollon77) Made sure the adapter is stopped before being updated
* (@Apollon77) Optimizes device discovery and allows to stop it again

### 0.2.10 (2024-12-19)
* (@bluefox) Makes the Adapter UI also available as standalone tab
* (@bluefox) Added error details when adding the same state twice to a bridge or device
* (@Apollon77) Fixes discovery start in UI

### 0.2.9 (2024-12-18)
* (@Apollon77) When Get and set states are separated then also update set state with new values
* (@Apollon77) Node details dialog in controller now exposes some more Battery information
* (@Apollon77) Also exposes the battery states when features are set wrong on the device
* (@Apollon77) Fixes LightSensor state mapping
* (@Apollon77) Prevents errors when only some energy states exist
* (@Apollon77) Uses the IP provided by Android when commissioning devices if possible
* (@Apollon77) Restructure discovery to run in the background and not block the UI
* (@Apollon77) Exposes States for Enums for Matter nodes
* (@Apollon77) Prevent storage to delete wrong data when a node gets removed

### 0.2.8 (2024-12-17)
* (@bluefox) Fixes progress dialog for DM - used when deleting a node
* (@bluefox) Synchronizes the "do not ask again on delete" time with admin and set to 5 minutes
* (@bluefox) Optimizes bridges display for different color schemes
* (@bluefox) Allows to collapse the information blocks at the top of the pages
* (@bluefox) Adds an ioBroker Logo when display commissioned controllers
* (@bluefox/@apollon77) Adds additional details and error state also for devices and bridged devices
* (@bluefox/@apollon77) Always display QR code to allow additional pairing for device and bridges from adapter UI
* (@bluefox) Optimizes several messages nd approval dialogs
* (@bluefox) Adds a welcome dialog for new users
* (@bluefox) Adds user guidance for big unpaired bridges
* (@Apollon77) Adds Illuminance and Button/ButtonSensor (Switch) device type
* (@Apollon77) Changes/Optimizes naming structure for paired devices and sub-endpoints
* (@Apollon77) Adds information when Matter device types are not yet supported to look into objects for details
* (@Apollon77) Resets connection status when a controller node is disconnected, also on adapter stop
* (@Apollon77) Cleans up internal data structures when a node gets deleted for controller
* (@Apollon77) Uses the configured device type when finding multiple types in the backend
* (@Apollon77) Adjusts UI device type detection to differentiate between supported and other types
* (@Apollon77) Makes sure that controller configuration changes are executed sequentially
* (@Apollon77) Added Transition Time handling for Dimmer and Ct device types in both directions
* (@Apollon77) Added Low-Battery and Battery-percent for all device types in both directions
* (@Apollon77) Added Ethernet Network Commissioning Cluster to prevent issues with Tuya

### 0.2.7 (2024-12-08)
* (@Apollon77) Cleans up objects when a controller node is deleted
* (@Apollon77) Prevents controller configuration changes to be executed in parallel

### 0.2.6 (2024-12-06)
* (@Apollon77) Fixes ColorTemperature light initialization because of matter.js update

### 0.2.5 (2024-12-06)
* (@Apollon77) Sets the "no-compose" flag correctly to normally use composed if needed and adds it to a missing dialog
* (@Apollon77) Allows using null values if needed
* (@Apollon77) Fixes UNREACH handling for devices
* (@Apollon77) Fixes object change handling for controller
* (@Apollon77) Allows Bridges to expose its name as a device name
* (@Apollon77) Allows to rename controller nodes and devices

### 0.2.4 (2024-12-04)
* (@Apollon77) Shows a progress indicator when deleting controller nodes
* (@Apollon77) Cuts names and labels to 32 or 64 characters as needed by Matter
* (@Apollon77) Improves error handling on devices and bridges
* (@Apollon77) Clear storage when removing a bridged device
* (@Apollon77) Processes changed objects with a 5s delay to prevent too many changes at once
* (@Apollon77) Fixes version determination
* (@Apollon77) Initializes Device objects more lazily

### 0.2.3 (2024-11-30)
* (@Apollon77) Makes sure to delete all objects and stop device when a device is deleted in UI
* (@Apollon77) When a devices/bridge object is deleted and adapter runs we try to detect this and stop the device/bridge
* (@Apollon77) Optimizes close handling of adapter
* (@Apollon77) Uses adapter version as Software and Hardware versions in the exposed Matter devices
* (@Apollon77) Fixes "auto" flags in backend when make no sense in objects
* (@Apollon77) Fixes "auto" flag in UI
* (@Apollon77) Prevents cyclic state updates when a state is updated by the adapter to matter
* (@Apollon77) Log warnings when device optional device states are not mapped
* (@Apollon77) Hides Product-ID and VendorId fields in UI when adding devices into a bridge

### 0.2.2 (2024-11-28)
* (@Apollon77) Uses plain matter.js logs for better readability
* (@Apollon77) Prevents ghost connection entries in the UI
* (@Apollon77) Adds some missing implementations for Controller of Door, Window, FloodAlarm and Motion

### 0.2.1 (2024-11-27)
* (@Apollon77) Adds Color Temperature conversion if unit is "mireds"
* (@Apollon77) Fixes Color Temperature cluster initialization
* (@Apollon77) Fixes Min/Max calculation when unit conversion is used

### 0.2.0 (2024-11-26)
* IMPORTANT: Breaking change!! Please decommission ALL devices and do a full factory reset of the adapter Matter storage before installing this version. Pair the devices new afterward. 
* (@Apollon77) Finalizes Devices, Bridges and Controller functionality with a first set of 11 device types
* (@Apollon77) Upgrades to new Matter.js version and API (breaks storage structure)
* (@GermanBluefox) Moved build process of GUI to vite
* (@GermanBluefox) Added possibility to group devices in the GUI

### 0.1.13 (2023-12-01)
* (@GermanBluefox) Working on the controller

### 0.1.10 (2023-11-13)
* (@GermanBluefox) Implemented the factory reset and re-announcing

### 0.1.2 (2023-10-25)
* (@GermanBluefox) Devices were implemented

### 0.0.5 (2023-10-24)
* (@GermanBluefox) Fixed names under linux

### 0.0.4 (2023-10-24)
* (@GermanBluefox) used library `@iobroker/type-detector`

### 0.0.2 (2023-10-23)
* (@GermanBluefox) Initial commit

## License
Apache-2.0

Copyright (c) 2023-2025 Denis Haev <dogafox@gmail.com>
