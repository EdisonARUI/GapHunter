import { Container, Heading } from '@radix-ui/themes';

export default function TestPage() {
  return (
    <Container>
      <div style={{ backgroundColor: 'black', padding: '20px', color: 'white' }}>
        <Heading style={{ color: 'white' }}>Test Page</Heading>
        <p>This is a test page to check layout issues.</p>
      </div>
    </Container>
  );
} 