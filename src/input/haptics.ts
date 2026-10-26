// A short buzz on phones (#84). Android has the Vibration API. iPhones don't, but Safari (17.4 and later)
// gives a tick when a switch-style checkbox is toggled, so on iPhones a hidden one is clicked instead.
// Either only works during a tap.

let iosSwitch: HTMLLabelElement | null = null;

function iosTick(): void {
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.setAttribute('switch', '');
    box.tabIndex = -1;
    iosSwitch.append(box);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}

/** A buzz of about `ms` milliseconds where the device can. */
export function buzz(ms: number): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  else if (matchMedia('(pointer: coarse)').matches) iosTick();
}
