package deu.se.hackathon.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String gender;
    private int age;
    private String symptoms;

    // 환자는 하나의 응급요청에 포함될 수 있음
    @OneToOne(mappedBy = "patient", cascade = CascadeType.ALL)
    private EmergencyCall emergencyCall;
}
