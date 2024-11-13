import React, { useEffect, useState } from "react";
import Janus, { JanusJS } from "janus-gateway";
import adapter from "webrtc-adapter";

const JanusSIP: React.FC = () => {
  const [janusInstance, setJanusInstance] = useState<any>(null);

  // Generate opaqueId only when component mounts
  const opaqueId = React.useMemo(() => {
    return "siptest-" + Math.random().toString(36).substr(2, 12);
  }, []);

  const [sipUri, setSipUri] = useState("");
  const [registered, setRegistered] = useState(false);
  const [sipCall, setSipCall] = useState<JanusJS.PluginHandle | null>(null);
  const dependencies = Janus.useDefaultDependencies({ adapter: adapter });

  // tracks
  const [remoteTracks, setRemoteTracks] = useState<any>({});

  useEffect(() => {
    // Ensure Janus is loaded before initialization
    const initializeJanus = async () => {
      try {
        // Initialize Janus
        await new Promise<void>((resolve) => {
          Janus.init({
            debug: "all",
            dependencies,
            callback: () => resolve(),
          });
        });

        if (!Janus.isWebrtcSupported()) {
          console.error("WebRTC is not supported");
          return;
        }

        // Create new Janus instance
        const janus = new Janus({
          server: "https://janus.ofon.id:8089/janus",
          success: () => {
            setJanusInstance(janus);

            // Attach the plugin
            janus.attach({
              plugin: "janus.plugin.sip",
              opaqueId: opaqueId,
              success: (handle) => {
                setSipCall(handle);
                console.log(
                  `Plugin attached! (${handle.getPlugin()}, id=${handle.getId()})`
                );
              },
              error: (error) => {
                console.error("Error attaching plugin", error);
              },
              consentDialog: (on) => {
                Janus.debug(
                  "Consent dialog should be " + (on ? "on" : "off") + " now"
                );
              },
              iceState: (state) => {
                Janus.log("ICE state changed to " + state);
              },
              mediaState: (medium, on, mid) => {
                Janus.log(
                  "Janus " +
                    (on ? "started" : "stopped") +
                    " receiving our " +
                    medium +
                    " (mid=" +
                    mid +
                    ")"
                );
              },
              webrtcState: (on) => {
                Janus.log(
                  "Janus says our WebRTC PeerConnection is " +
                    (on ? "up" : "down") +
                    " now"
                );
              },
              slowLink: (uplink, lost, mid) => {
                Janus.warn(
                  "Janus reports problems " +
                    (uplink ? "sending" : "receiving") +
                    " packets on mid " +
                    mid +
                    " (" +
                    lost +
                    " lost packets)"
                );
              },
              onmessage: (msg, jsep) => {
                Janus.log(" ::: Got a message OIT  :::", msg);
                const error = msg.error;
              },
              onremotetrack: (track, mid, on) => {
                Janus.debug(
                  "Remote track (mid=" +
                    mid +
                    ") " +
                    (on ? "added" : "removed") +
                    ":",
                  track
                );

                if (!on) {
                  // Track removed, get rid of the stream and the rendering
                  delete remoteTracks[mid];
                  return;
                }

                if (track.kind === "audio") {
                  const stream = new MediaStream([track]);
                  setRemoteTracks({ ...remoteTracks, mid: stream });
                  Janus.log("Created remote audio stream:", stream);
                }
              },
            });
          },

          error: (error) => {
            console.error("Error creating Janus instance", error);
          },
        });
      } catch (error) {
        console.error("Error initializing Janus:", error);
      }
    };

    initializeJanus();

    // Cleanup function
    return () => {
      if (janusInstance) {
        janusInstance.destroy();
      }
    };
  }, []);

  const register = () => {
    const register = {
      proxy: "sip:pipeline.pbx002.ofon.biz:5060",
      request: "register",
      username: "sip:user_c3ectYSg2C@pipeline.pbx002.ofon.biz",
      secret: "XctY92x23gQF",
      display_name: "Dzaky Nashshar",
    };
    sipCall?.send({ message: register });
    console.log("registered");
  };

  const handleCall = (uri: string) => {
    // sipCall?.doAudio = true;
    sipCall?.createOffer({
      tracks: [{ type: "audio", capture: true, recv: true }],
      success: (jsep) => {
        Janus.log("GOT SDP!", jsep);
        const body = { request: "call", uri: uri, srtp: "sdes_optional" };
        sipCall.send({ message: body, jsep: jsep });
      },
      error: function (error) {
        Janus.error("webRTC error", error);
      },
    });
  };

  return (
    <div>
      <h2>JanusSIP</h2>
      {!janusInstance && <p>Initializing Janus...</p>}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <input
          type="text"
          value={sipUri}
          onChange={(e) => setSipUri(e.target.value)}
        />
        <button onClick={() => handleCall(sipUri)}>Call</button>
        <button onClick={register}>Register</button>
      </div>
    </div>
  );
};

export default JanusSIP;
