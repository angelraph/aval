"use client";

/**
 * EIP-6963: Multi Injected Provider Discovery. Every installed wallet extension announces
 * itself on the page instead of fighting over a single window.ethereum, so a page can list them
 * all and let the user pick, instead of always grabbing whichever wallet loaded last.
 * https://eips.ethereum.org/EIPS/eip-6963
 */
export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any;
}

/**
 * Listens for wallet announcements and reports the current set whenever it changes. Also
 * dispatches a request so wallets that were already listening before this ran still announce
 * themselves. Returns an unsubscribe function.
 */
export function subscribeToWallets(onChange: (wallets: EIP6963ProviderDetail[]) => void): () => void {
  const wallets = new Map<string, EIP6963ProviderDetail>();

  function handleAnnouncement(event: Event) {
    const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
    if (!detail?.info?.uuid) return;
    wallets.set(detail.info.uuid, detail);
    onChange(Array.from(wallets.values()));
  }

  window.addEventListener("eip6963:announceProvider", handleAnnouncement as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  return () => {
    window.removeEventListener("eip6963:announceProvider", handleAnnouncement as EventListener);
  };
}
