import { createSignal } from "solid-js";

const useAppBadge = () => {
    const [counter, setCounter] = createSignal(1)

    
  const setBadge = () => {
    setCounter(counter() + 1);
    if (navigator.setAppBadge) {
      navigator.setAppBadge(counter());
    } else if (navigator.setClientBadge) {
      navigator.setClientBadge();
    }
  };
    
  const clearBadge = () => {
    setCounter(1);
    if (navigator.clearAppBadge) {
      navigator.clearAppBadge();
    } else if (navigator.clearClientBadge) {
      navigator.clearClientBadge();
    }
  };

  return [setBadge, clearBadge];
};

export default useAppBadge;