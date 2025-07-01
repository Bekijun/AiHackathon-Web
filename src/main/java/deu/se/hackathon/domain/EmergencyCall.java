package deu.se.hackathon.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmergencyCall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime requestTime;

    // 구급대원이 생성
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User createdBy;

    @OneToOne
    @JoinColumn(name = "patient_id")
    private Patient patient;

    // 여러 병원에게 동시에 전달 가능
    @OneToMany(mappedBy = "emergencyCall", cascade = CascadeType.ALL)
    private List<Notification> notifications;
}
