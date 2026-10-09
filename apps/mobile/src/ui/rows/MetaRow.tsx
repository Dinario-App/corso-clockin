import { Text, View } from 'react-native';
import {
  META_ROW_INFO_MARK,
  resolveMetaRowPresentation,
  type MetaRowEmphasis,
} from '@/src/ui/rows/metaRowPresentation.js';

export type MetaRowProps = {
  /** Non-empty meta label — e.g. `Network fee`, `Slippage`. */
  label: string;
  /** Non-empty meta value — e.g. `$0.02`, `0.5%`. */
  value: string;
  /** When true, renders the literal informational mark adjacent to the label. */
  hasInfo?: boolean;
  emphasis: MetaRowEmphasis;
  testID?: string;
};

export function MetaRow({
  label,
  value,
  hasInfo,
  emphasis,
  testID,
}: MetaRowProps) {
  const presentation = resolveMetaRowPresentation({
    label,
    value,
    hasInfo,
    emphasis,
  });

  return (
    <View
      testID={testID}
      style={presentation.containerStyle}
      accessible
      accessibilityLabel={presentation.accessibilityLabel}
    >
      <View style={presentation.labelRowStyle}>
        <Text style={presentation.labelStyle} accessible={false}>
          {presentation.labelText}
        </Text>
        {presentation.showInfoMark ? (
          <Text style={presentation.infoMarkStyle} accessible={false}>
            {META_ROW_INFO_MARK}
          </Text>
        ) : null}
      </View>
      <Text style={presentation.valueStyle} accessible={false}>
        {presentation.valueText}
      </Text>
    </View>
  );
}
