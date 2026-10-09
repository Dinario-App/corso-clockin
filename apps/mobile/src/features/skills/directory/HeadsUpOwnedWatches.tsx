import { useEffect } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { copy } from "@/constants/copy";
import { CorsoText } from "@/src/theme/CorsoText";
import { StepUpSheet } from "@/src/features/security/StepUpSheet";
import { spacing } from "@/src/ui/tokens";
import { useHeadsUpData } from "./useHeadsUpData";
export function HeadsUpOwnedWatches({
  addedWatchId,
  onRemoved,
}: {
  addedWatchId: string | null;
  onRemoved(id: string): void;
}) {
  const data = useHeadsUpData("watches");
  useEffect(() => {
    if (addedWatchId) void data.refresh();
  }, [addedWatchId, data.refresh]);
  return (
    <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
      {data.status === "loading" ? <ActivityIndicator /> : null}
      {data.status === "error" ? (
        <Pressable
          onPress={() => void data.refresh()}
          accessibilityRole="button"
        >
          <CorsoText>{copy.skills.test.retry}</CorsoText>
        </Pressable>
      ) : null}
      {data.watches.map((watch) => (
        <View key={watch.id} style={{ gap: spacing.sm }}>
          <CorsoText>
            {watch.mint.slice(0, 6)}…{watch.mint.slice(-4)} · {watch.timeframe}
          </CorsoText>
          {/* Heads-Up Remove stops future alerts; past events stay inactive until 30-day expiry; no Heads-Up copy may say or imply Remove deletes history. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${copy.ai.remove} ${watch.mint} ${watch.timeframe}`}
            disabled={!!data.removing || data.status === "loading"}
            onPress={() =>
              void data.remove(watch.id).then((removed) => {
                if (removed) onRemoved(watch.id);
              })
            }
            style={{ minHeight: 44, justifyContent: "center" }}
            testID={`heads-up-remove-${watch.id}`}
          >
            {data.removing === watch.id ? (
              <ActivityIndicator />
            ) : (
              <CorsoText>{copy.ai.remove}</CorsoText>
            )}
          </Pressable>
        </View>
      ))}
      <StepUpSheet {...data.stepUpSheet} />
    </View>
  );
}
