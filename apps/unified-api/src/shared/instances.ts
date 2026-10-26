// "https://unified-api-dc01.example.net:8443" -> "dc01": the
// part of the hostname that differs between instances. One spelling for
// every page that names an instance (Topology, a remote source's overview).
export function instanceName(url: string) {
  try {
    const { hostname, host } = new URL(url);
    // An address, not a name ("10.0.4.17", "localhost"): its first part says
    // nothing, so the address and port name it.
    if (hostname === "localhost" || /^[\d.]+$|^\[/.test(hostname)) return host;
    const first = hostname.split(".")[0];
    return first.replace(/^unified-api-?/, "") || first;
  } catch {
    return url;
  }
}
