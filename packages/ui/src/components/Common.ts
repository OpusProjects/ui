import styles from "./Common.module.css";

// Classes list and detail pages share across apps: mono and soft text, an
// outbound link, the two-column metrics grid, plain reference tables, a
// folding section. Exported as a module so every app's pages read alike.
export { styles as pageStyles };
