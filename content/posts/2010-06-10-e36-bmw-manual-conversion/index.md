---
author: "Sam McLeod"
readingTime: true
categories: [ Cars ]
date: "2010-06-10T00:00:00Z"
aliases:
  - /cars/2010/06/22/e36-bmw-manual-conversion/
image: ivan-angelov-ITEOjp8utXc-unsplash.jpg
featuredImagePreview: ivan-angelov-ITEOjp8utXc-unsplash.jpg
tags:
- cars
title: BMW E36 328i Manual Conversion Programming
---


## Reprogram BMW after doing Automatic to Manual Conversion

Based on my E36 328is experience, **written in 2010**.

## Assumptions

This guide assumes the following:

- You have programmed a BMW ECU/DME before using DIS or similar.
- You are taking all the necessary safety precautions. (Fully charged battery etc…)
- You have DIS working (We used EasyDIS 1.0, Base 44)
- You have Ediabas (INPA, NCS Expert, IFH Serve) installed and working.
- You're able to read between the lines of our crappy document, some steps may differ slightly and our wording may be somewhat imprecise.

## Data Gathering

Make notes of the following:

- Your Basic Control Unit part number. (Mine is `1429861`)
- The equivalent Programmed Control Unit to suit your car but for a manual spec (mine was 1429954) - I found several available on parts websites online.
- Your VIN

## My Conversion

Some background on my conversion:

- We did this on a 1996 OBD1 Euro 328i Coupe, Siemens MS41.0 with Getrag 260 manual conversion.
- We used a Carsoft cable (Chinese version) that had been modified to provide voltage readings and had several pins bridged to work with ODB1.
- We will take no responsibly for ANY damage that could be caused by this process - use at your own risk!

## Reprogramming

If you simply reflash your ECU/DME to a part number from a manual, the ZCS coding values stored in the EWS will cause your ECU/DME to think the automatic box is still installed!

To fix this, you need to change the GM code stored in the EWS; this is done through comparing a value from the `E36ZST.000` file in NCS Expert's Daten Folder with your current GM code. This is simpler than it sounds.

### Steps

1. Find your current GM code from DIS; this is located in programming under ZCS/FA Coding - Choose Print Current Values. Answer the questions provided and note down all three codes when you get them. (GM, SA & VM will be displayed).

2. Open the following file in notepad `C:\NCSEXPER\DATEN\E36\E36ZST.000`

3. Find the line with your model, engine, old transmission and US/Euro information. You will see a 8 character value on the left of the large number of 0's that will look something like 11B20000. (The non-0 parts of this number should match the start of your GM code.)

4. Locate the same car but in manual, you will see the value above is slightly different, for an e36 328-coupe manual the value is `11A20000` - Note this down as it will be the base for your new GM code.

5. Now match your new GM code found in the last step with your current GM code provided by DIS but ignoring the last digit, which is only a checksum value. For example:

- Old GM code from DIS: `11B20700B`
- I found the manual GM base code to be `11A20000`
- My new GM code will be `11A20700` (and we will work out the last digit in the next step).

6. Open NCS Expert. (My version is in German)

- Click File > Load Profile
- Choose Expert Mode
- Press the first button - `FG/ZCS/FA`
- Press the first button again - `ZCS eingeben`
- Choose your model (`e36`)
- Insert your VIN, Press OK
- Enter your new GM (without the last digit) (Eg: `11A20700`)
- Enter your current SA (without the last digit) (Eg: `0000482001228491`)
- Enter your current VN (without the last digit) (Eg: `0004BFA936`)
- Tick `checksumme berechnen` and press OK.

7. Now in the top part of the display you will be provided with your new GM including your last character, which is the checksum value (mine was 11A207008).

8. Back in DIS / Programming:

- Choose ZCS/FA Coding
- Choose Recoding
- Choose the EWS module

9. If you get prompted something along the lines of ‘Are these correct?' when displaying the current GM,SA & VM values - Choose NO.

10. Enter your new GM and your original SA & VN (these wont have changed).
Go through the programming process as normal.

11. Now we go to DME Programming
Choose exchange control unit
Determine Control Unit

12. When asked “Is the faulty unit still installed in the car?” choose NO.

13. Enter data:

- Your current basic control unit part number. (Mine was `1429861`).
- Your chassis number.
- Your replacement programmed control unit part number (Mine was `1429954`).

14. You'll need to click down a few times, then back to ‘Program Control Unit'
Enter details are requested (Kms, Chassis number), Start programming! (Make sure your battery is full of juice!)

15. DIS will now walk you through clearing your adaptation values.

16. Open ZCS/FA programming; follow the process to Align-EWS to DME.

17. Open DIS - Diagnostics and do a quick clear of errors.

All done!

### Results

You should notice:

- At first the car will not be that zippy, as it has to relearn its adaptation values.
- Once the car is warm, the idle speed will drop from the automatic 650-700RPM to 500-550RPM manual setting.
- When changing gears you will notice the rev's drop a lot faster between gear changes (if you have a lightened flywheel you revs may still rise 200RPM~ at times.)
- I'm not 100% sure on this one as I've only just done it, but I'm pretty sure the car actually feels a bit peppier at the top-end also, mine actually seems to sound a bit deeper when applying revs!

## Carsoft Cable Mods

- Pin 16 of the 20pin diag connector needs to be connected through a 4k7 resistor to pin 9 of the serial port.
- Pin 1 of the 20p diag via 4k7 to pin 6 on the serial.

The above two allow INPA and friends to detect battery and ignition. Could connect direct without the resistors but you're in megadanger of blowing up your serial port so definitely use the resistors.

- Pin 14 on the 20pin diag connector needs to be bridged (no resistor just a link) to pin 18 on the diag connector for OBDI cars to allow programming.

### The 20pin Diagnostics Connector

- Pin 1 is terminal 15 (ignition voltage).
- Pin 14 is an always on 12v source.
- Pin 16 is terminal 30 (battery voltage).
- Pin 18 is programming voltage for OBDI cars (not fitted in my E46).

### The Serial Port

- Pin 6 is Data Set Ready "DSR" (used by EDIABAS for ignition detect).
- Pin 9 is Ring Indicator "RI" (used for battery detect).

On the carsoft cable the serial DB9 male to female has all wires in it pin for pin. The 20pin diag connector to the DB15 however only has 4 wires in it so an additional 2 wires will need to be added for the above mods.

[Revision 1.1 - 22/6/10]
