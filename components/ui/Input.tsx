import { TextInput, View, Text, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <View style={{ marginBottom: 16 }} className={`mb-4 ${className}`}>
      {label && (
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#A0A0A0', marginBottom: 8 }}>{label}</Text>
      )}
      <TextInput
        style={{
          backgroundColor: '#222222',
          borderWidth: 1,
          borderColor: error ? '#FF3B30' : '#2A2A2A',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 16,
          color: '#FFFFFF',
        }}
        placeholderTextColor="#666666"
        {...props}
      />
      {error && <Text style={{ color: '#FF3B30', fontSize: 14, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}
